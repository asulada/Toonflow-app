import { t, translateMessage } from "@/lib/i18n";
import { mkdir, readFile, realpath, stat, unlink } from "@toonflow/file";
import { join, relative } from "node:path";
import { mediaProviders, type Provider } from "@toonflow/providers";
import type { GeneratedMedia, MediaGenerationRequest, MediaModel, MediaReference } from "@toonflow/tools-scaffold/runtime";
import conf from "@/utils/conf";
import { getMediaProvider, listMediaProviders, loadMediaProviderSource } from "@/utils/media/provider";
import { lockWorkspaceFiles, resolveWorkspacePath, writeWorkspaceFile } from "@/utils/workspace/files";

const maxMediaSize = 100 * 1024 * 1024;
const mediaExtensions: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
  "image/avif": "avif", "image/bmp": "bmp", "image/tiff": "tiff",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/ogg": "ogv",
  "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg", "audio/webm": "webm",
  "audio/flac": "flac", "audio/aac": "aac", "audio/mp4": "m4a", "audio/opus": "opus", "audio/pcm": "pcm",
};

function invalid(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function imageOptions(value: unknown, pattern: RegExp) {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length <= 64 && item === item.trim() && pattern.test(item)))] : undefined;
}

// ACT: 宿主只认领 ProviderModel 已声明的字段，模型配置里其余键按约定作为供应商专属参数透传到 request.other。
// params / presets 是模型级的界面声明（可填参数名、一键预设），只服务于编辑界面，不能跟着生成请求下发。
const modelReservedKeys = new Set(["id", "label", "type", "think", "mode", "associationSkills", "audio", "imageSizes", "imageRatios", "durationResolutionMap", "voices", "params", "presets"]);

// ACT: 模型级预设必须是 {label, params} 的字面量列表；坏数据静默丢弃，避免污染界面。
// source 由供应商文件显式声明，缺省视为 builtin（预置预设）。
function modelPresets(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const presets = value.flatMap(item => {
    const entry = record(item);
    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    const params = record(entry.params);
    if (!label || label.length > 64 || !Object.keys(params).length || Object.keys(params).length > 64) return [];
    return [{ label, params, source: entry.source === "user" ? "user" as const : "builtin" as const }];
  });
  return presets.length ? presets : undefined;
}

// ACT: 用户自定义预设按模型 ID 存在应用设置里，与供应商文件解耦，因此重传供应商 ts 不会丢。
function modelUserPresets(value: unknown, modelId: string) {
  const list = record(value)[modelId];
  if (!Array.isArray(list)) return [];
  return list.flatMap(item => {
    const entry = record(item);
    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    const params = record(entry.params);
    return label && label.length <= 64 && Object.keys(params).length ? [{ label, params, source: "user" as const }] : [];
  });
}

// ACT: 同名以用户自定义为准（用户可覆盖供应商预置项），其余按「预置在前、自定义在后」排列。
function mergePresets(builtin: ReturnType<typeof modelPresets>, user: ReturnType<typeof modelUserPresets>) {
  const base = builtin ?? [];
  if (!user.length) return builtin;
  if (!base.length) return user;
  return [...base.filter(item => !user.some(entry => entry.label === item.label)), ...user];
}

function modelParams(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const params = [...new Set(value.filter((item): item is string => typeof item === "string" && !!item.trim() && item.length <= 64))];
  return params.length ? params : undefined;
}

function modelOtherParams(model: unknown) {
  const other = Object.fromEntries(Object.entries(record(model)).filter(([key]) => !modelReservedKeys.has(key)));
  return Object.keys(other).length ? other : undefined;
}

export async function listMediaModels(): Promise<MediaModel[]> {
  const installedProviders = await listMediaProviders();
  const configurations = record(conf.get("settings", {}).mediaProviderConfigs);
  return installedProviders.flatMap(provider => {
    const stored = record(configurations[provider.id]).presets;
    return provider.models.flatMap(model => {
      if (model.type !== "image" && model.type !== "video" && model.type !== "audio") return [];
      const builtIn = (mediaProviders as readonly Provider[]).find(item => item.id === provider.id)?.models.find(item => item.id === model.id);
      return [{
        providerId: provider.id, providerLabel: provider.label, modelId: model.id, label: model.label, type: model.type,
        mode: model.mode, durationResolutionMap: model.durationResolutionMap, audio: model.audio,
        // ACT: 模型可自带「可填参数名」与「一键预设」，界面按所选模型渲染，不同模型互不共用；
        // 预置预设来自供应商文件，用户自定义预设来自应用设置，同名时以用户自定义为准。
        params: modelParams(model.params), presets: mergePresets(modelPresets(model.presets), modelUserPresets(stored, model.id)),
        ...(model.type === "audio" ? { voices: model.voices } : {}),
        ...(model.type === "image" ? {
          imageSizes: imageOptions(Array.isArray(model.imageSizes) ? model.imageSizes : builtIn?.imageSizes, /^[^\u0000-\u001f\u007f]+$/),
          imageRatios: imageOptions(Array.isArray(model.imageRatios) ? model.imageRatios : builtIn?.imageRatios, /^[1-9]\d{0,3}:[1-9]\d{0,3}$/),
        } : {}),
      } as MediaModel];
    });
  });
}

function detectMimeType(bytes: Uint8Array, fallback: string) {
  const header = Buffer.from(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, 16));
  const text = header.toString("ascii");
  const mimeType = fallback.split(";")[0].trim().toLowerCase();
  if (header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (header[0] === 255 && header[1] === 216 && header[2] === 255) return "image/jpeg";
  if (/^GIF8[79]a/.test(text)) return "image/gif";
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WEBP") return "image/webp";
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WAVE") return "audio/wav";
  if (text.startsWith("fLaC")) return "audio/flac";
  if (text.startsWith("OggS")) return mimeType.startsWith("video/") ? "video/ogg" : mimeType === "audio/opus" ? "audio/opus" : "audio/ogg";
  if (header[0] === 0xff && (header[1]! & 0xf6) === 0xf0) return "audio/aac";
  if (text.startsWith("ID3") || (header[0] === 0xff && (header[1]! & 0xe0) === 0xe0 && (header[1]! & 0x06) !== 0)) return "audio/mpeg";
  if (text.slice(4, 8) === "ftyp") {
    if (/avif|avis/.test(text.slice(8))) return "image/avif";
    if (/^M4[AB] $/.test(text.slice(8, 12)) || mimeType.startsWith("audio/")) return "audio/mp4";
    return text.slice(8, 12) === "qt  " ? "video/quicktime" : "video/mp4";
  }
  if (header.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))) return mimeType.startsWith("audio/") ? "audio/webm" : "video/webm";
  return ({ "image/jpg": "image/jpeg", "audio/mp3": "audio/mpeg", "audio/x-wav": "audio/wav", "audio/wave": "audio/wav", "audio/x-flac": "audio/flac" } as Record<string, string>)[mimeType] ?? mimeType;
}

export async function readReference(cwd: string, reference: MediaReference, mediaType: string, signal?: AbortSignal): Promise<Extract<MediaInput, { type: "base64" }>> {
  signal?.throwIfAborted();
  const { path } = await resolveWorkspacePath(cwd, reference.path);
  const info = await stat(path);
  if (!info.isFile() || info.size > maxMediaSize) invalid("参考媒体须为不超过 100 MB 的文件");
  const bytes = await readFile(path, { signal });
  if (!bytes.length || bytes.length > maxMediaSize) invalid("参考媒体为空或超过 100 MB");
  const mimeType = detectMimeType(bytes, reference.mimeType);
  if (!mimeType.startsWith(`${mediaType}/`)) invalid(t`参考媒体类型须为 ${mediaType}`);
  return { type: "base64", data: bytes.toString("base64"), mimeType };
}

async function downloadAsset(url: string, signal?: AbortSignal) {
  if (!/^https?:\/\//i.test(url)) invalid("生成结果必须使用 HTTP 或 HTTPS 地址");
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(t`下载生成结果失败（HTTP ${response.status}）`);
  if (Number(response.headers.get("content-length")) > maxMediaSize) {
    await response.body?.cancel();
    invalid("生成文件不能超过 100 MB");
  }
  const reader = response.body?.getReader();
  if (!reader) invalid("生成结果为空");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxMediaSize) invalid("生成文件不能超过 100 MB");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return { bytes: Buffer.concat(chunks, size), mimeType: response.headers.get("content-type") ?? "" };
}

async function assetBytes(asset: MediaAsset, mediaType: "image" | "video" | "audio", signal?: AbortSignal) {
  if (!asset || asset.mediaType !== mediaType) invalid("供应商返回的媒体类型不正确");
  let bytes: Uint8Array;
  let mimeType = asset.mimeType ?? "";
  if (asset.type === "url") {
    const result = await downloadAsset(asset.url, signal);
    bytes = result.bytes;
    const responseMimeType = result.mimeType.split(";")[0].trim().toLowerCase();
    mimeType = responseMimeType && responseMimeType !== "application/octet-stream" ? result.mimeType : mimeType;
  } else if (asset.type === "base64") {
    const data = /^data:([^;,]+);base64,([\s\S]+)$/.exec(asset.data);
    const content = (data?.[2] ?? asset.data).replace(/\s/g, "");
    if (content.length > Math.ceil(maxMediaSize / 3) * 4 || !/^[a-zA-Z0-9+/]*={0,2}$/.test(content) || content.length % 4 === 1) invalid("生成结果的 base64 内容无效或超过 100 MB");
    bytes = Buffer.from(content, "base64");
    mimeType = data?.[1] ?? mimeType;
  } else if (asset.type === "binary" && ArrayBuffer.isView(asset.data) && asset.data.BYTES_PER_ELEMENT === 1) {
    bytes = asset.data;
  } else { return invalid("供应商返回了无效的媒体结果"); }
  if (!bytes.byteLength || bytes.byteLength > maxMediaSize) invalid("生成文件为空或超过 100 MB");
  mimeType = detectMimeType(bytes, mimeType);
  if (!mimeType.startsWith(`${mediaType}/`) || !mediaExtensions[mimeType]) invalid("生成结果不是支持的图片、视频或音频格式");
  return { bytes, mimeType };
}

export async function generateMedia(
  cwd: string,
  mediaType: "image" | "video" | "audio",
  request: MediaGenerationRequest,
  signal?: AbortSignal,
): Promise<GeneratedMedia[]> {
  signal?.throwIfAborted();
  if (!request.prompt.trim()) invalid("请输入生成提示词");
  const directory = await realpath(cwd);
  const outputDirectory = request.outputDirectory ?? "assets/generated";
  await resolveWorkspacePath(directory, outputDirectory, true);
  const providerInfo = await getMediaProvider(request.providerId);
  const model = providerInfo.models.find(model => model.id === request.modelId && model.type === mediaType);
  if (!model) invalid("所选媒体模型不存在或类型不匹配，请重新选择");
  const configurations = record(conf.get("settings", {}).mediaProviderConfigs);
  // ACT: 参数预设按名称展开成 other（预置 + 用户自定义，同名以用户自定义为准）；未指定预设时行为不变。
  const preset = request.preset
    ? mergePresets(modelPresets(model.presets), modelUserPresets(record(configurations[providerInfo.id]).presets, model.id))?.find(item => item.label === request.preset)
    : undefined;
  if (request.preset && !preset) invalid(`该模型没有名为「${request.preset}」的参数预设`);
  // ACT: 本次生成的自定义参数覆盖模型配置里的默认值；两者都为空时不传，供应商行为保持不变。
  const mergedParams = { ...modelOtherParams(model), ...(preset?.params ?? {}), ...record(request.other) };
  const other = Object.keys(mergedParams).length ? mergedParams : undefined;
  const provider = await loadMediaProviderSource(providerInfo.source, record(configurations[providerInfo.id]), signal, undefined, directory);
  const generate = mediaType === "image" ? provider.generateImage : mediaType === "video" ? provider.generateVideo : provider.generateAudio;
  if (typeof generate !== "function") invalid(t`此供应商不支持${translateMessage({ image: "图片", video: "视频", audio: "音频" }[mediaType])}生成`);
  const rules = Array.isArray(provider.rules) ? provider.rules : [];
  if (rules.some(rule => rule.field === "apiKey") && (typeof provider.config.apiKey !== "string" || !provider.config.apiKey.trim())) invalid("请先在媒体模型设置中配置供应商 API Key");
  const references = async (items: MediaReference[] | undefined, type: string) => items ? Promise.all(items.map(item => readReference(directory, item, type, signal))) : undefined;
  const images = await references(request.images, "image");
  signal?.throwIfAborted();
  const assets = mediaType === "audio"
    ? await provider.generateAudio!({
      model: request.modelId, text: request.prompt, images, audios: await references(request.audios, "audio"),
      voice: request.voice, speed: request.speed, volume: request.volume, pitch: request.pitch, language: request.language, format: request.format, sampleRate: request.sampleRate,
      other,
    })
    : mediaType === "image"
    ? await provider.generateImage!({ model: request.modelId, prompt: request.prompt, images, ratio: request.ratio, size: request.size, other })
    : await provider.generateVideo!({
      model: request.modelId, prompt: request.prompt, images,
      videos: await references(request.videos, "video"), audios: await references(request.audios, "audio"),
      firstFrame: request.firstFrame ? await readReference(directory, request.firstFrame, "image", signal) : undefined,
      lastFrame: request.lastFrame ? await readReference(directory, request.lastFrame, "image", signal) : undefined,
      ratio: request.ratio, resolution: request.resolution, duration: request.duration,
      generateAudio: request.generateAudio, mode: request.mode,
      other,
    });
  if (!Array.isArray(assets) || !assets.length) invalid("供应商未返回生成结果");
  const written: string[] = [];
  const result: GeneratedMedia[] = [];
  try {
    for (const asset of assets) {
      signal?.throwIfAborted();
      const { bytes, mimeType } = await assetBytes(asset, mediaType, signal);
      signal?.throwIfAborted();
      const output = await resolveWorkspacePath(directory, outputDirectory, true);
      const release = lockWorkspaceFiles([output.path]);
      try {
        await mkdir(output.path, { recursive: true });
        const file = join(outputDirectory, `${mediaType}${crypto.randomUUID()}.${mediaExtensions[mimeType]}`);
        const { path } = await resolveWorkspacePath(directory, file);
        signal?.throwIfAborted();
        await writeWorkspaceFile(path, bytes, true);
        written.push(path);
        result.push({ path: relative(directory, path).replace(/\\/g, "/"), mimeType, mediaType });
      } finally { release(); }
    }
    signal?.throwIfAborted();
    return result;
  } catch (err) {
    // ACT: 只回滚本次创建的文件，保留目录中已有的节点资源。
    await Promise.all(written.map(path => unlink(path).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; })));
    throw err;
  }
}
