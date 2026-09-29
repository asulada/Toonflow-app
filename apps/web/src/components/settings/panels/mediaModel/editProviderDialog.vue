<template>
  <el-dialog
    v-model="visible"
    :title="`编辑媒体供应商：${provider?.label ?? ''}`"
    width="min(800px, calc(100vw - 32px))"
    alignCenter
    appendToBody
    destroyOnClose
    :closeOnClickModal="false"
    :closeOnPressEscape="!saving"
    :showClose="!saving">
    <div class="providerEditor">
      <messageMarkdown v-if="provider?.readme" class="providerReadme" :content="provider.readme" />
      <el-form labelPosition="top" :disabled="saving">
        <el-form-item label="API Key">
          <el-input v-model="apiKey" :prefixIcon="IconKey" type="password" showPassword autocomplete="off" aria-label="媒体供应商 API Key" />
        </el-form-item>
      </el-form>
      <div class="modelHeader">
        <h4>模型配置 <el-text type="info">{{ models.length }}</el-text></h4>
        <div class="headerActions">
          <el-button :icon="IconDownload" size="small" :disabled="saving || !presetCount" @click="exportPresets">导出预设</el-button>
          <el-button :icon="IconUpload" size="small" :disabled="saving" @click="pickPresetFile">导入预设</el-button>
          <el-button :icon="IconPlus" size="small" :disabled="saving" @click="editModel()">手动添加</el-button>
        </div>
        <input ref="presetFileInput" type="file" accept="application/json,.json" hidden @change="importPresets" />
      </div>
      <div class="modelList">
        <el-card v-for="(item, index) in models" :key="index" class="modelCard" shadow="never">
          <div class="topInfo">
            <div class="modelNameWrap">
              <modelIcon :model="item.id" :size="24" />
              <div class="modelInfo">
                <span class="modelName">{{ item.label }}</span>
                <el-text class="modelId" type="info" size="small">{{ item.id }}</el-text>
              </div>
            </div>
            <div class="actionButtons">
              <el-button text size="small" :icon="IconEdit" :disabled="saving" :aria-label="`编辑模型 ${item.label}`" @click="editModel(index)">编辑</el-button>
              <el-button text size="small" type="danger" :icon="IconTrash" :disabled="saving" :aria-label="`删除模型 ${item.label}`" @click="removeModel(index)">删除</el-button>
            </div>
          </div>
          <div class="modelTags">
            <el-tag size="small">{{ modelTypes[item.type] }}</el-tag>
            <el-tag v-for="(tag, tagIndex) in modelTags(item)" :key="tagIndex" size="small" type="info">{{ tag }}</el-tag>
          </div>
        </el-card>
        <el-text v-if="!models.length" type="info">暂无模型</el-text>
      </div>
    </div>
    <el-alert v-if="formError" class="formError" :title="formError" type="error" :closable="false" showIcon />
    <el-alert v-else-if="formNotice" class="formError" :title="formNotice" type="success" :closable="false" showIcon />
    <template #footer>
      <el-button :disabled="saving" @click="visible = false">取消</el-button>
      <el-button type="primary" :icon="IconDeviceFloppy" :loading="saving" @click="saveModels">保存</el-button>
    </template>
    <component
      :is="modelEditorDialog"
      v-model="modelEditorVisible"
      :model="editingModelIndex === undefined ? undefined : models[editingModelIndex]"
      :models="models"
      :presets="editingPresets"
      @confirmed="confirmModel" />
  </el-dialog>
</template>

<script setup lang="ts">
import axios from "axios";
import { computed, defineAsyncComponent, ref, shallowRef, watch, type Component } from "vue";
import { IconPlus, IconTrash, IconDeviceFloppy, IconEdit, IconKey, IconDownload, IconUpload } from "@tabler/icons-vue";
import { modelIcon } from "@toonflow/model-icons";
import messageMarkdown from "@/components/messageMarkdown.vue";
import type { MediaProvider, MediaProviderModel, MediaProviderPreset, MediaProviderPresets } from "./types";
import { settings, saveSettings } from "@/stores/settings";
import { invalidateNodeModels } from "@toonflow/nodes-scaffold/nodeAi";

const { provider } = defineProps<{ provider?: MediaProvider }>();
const modelEditorDialog = shallowRef<Component>();
const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ saved: [provider: MediaProvider] }>();
const models = ref<MediaProviderModel[]>([]);
const modelEditorVisible = ref(false);
const editingModelIndex = ref<number>();
const saving = ref(false);
const apiKey = ref("");
const formError = ref("");
const formNotice = ref("");
const presetFileInput = ref<HTMLInputElement>();
// ACT: 用户自定义预设按模型 ID 归档并存在应用设置里；供应商 ts 里声明的预置预设不在这份数据里。
const userPresets = ref<MediaProviderPresets>({});
const presetCount = computed(() => Object.values(userPresets.value).reduce((total, list) => total + list.length, 0));
const editingPresets = computed(() => {
  const index = editingModelIndex.value;
  const model = index === undefined ? undefined : models.value[index];
  return model ? userPresets.value[model.id] ?? [] : [];
});
const modelTypes = { image: "图片", video: "视频", audio: "音频", text: "文本" };
const modeLabels: Record<string, string> = {
  singleImage: "单图参考", multiReference: "多图参考", startEndRequired: "首尾帧必填",
  endFrameOptional: "尾帧可选", startFrameOptional: "首帧可选",
  imageReference: "图片参考", videoReference: "视频参考", audioReference: "音频参考",
};

watch(visible, isVisible => {
  if (!isVisible) return;
  formError.value = "";
  formNotice.value = "";
  modelEditorVisible.value = false;
  editingModelIndex.value = undefined;
  const configs = settings.value.mediaProviderConfigs as Record<string, { apiKey?: unknown }> | undefined;
  const configuredKey = provider && configs?.[provider.id]?.apiKey;
  apiKey.value = typeof configuredKey === "string" ? configuredKey : "";
  models.value = JSON.parse(JSON.stringify(provider?.models ?? []));
  userPresets.value = {};
  void loadPresets();
}, { immediate: true });

async function loadPresets() {
  if (!provider) return;
  try {
    const { data } = await axios.get<{ data: { presets: MediaProviderPresets } }>("/api/providers/media/presets", {
      params: { fileName: provider.fileName },
    });
    userPresets.value = data.data?.presets ?? {};
  } catch {
    // ACT: 预设是附属数据，读取失败（例如供应商文件刚被删除）不应挡住模型编辑。
    userPresets.value = {};
  }
}

/** 只保留当前模型列表里仍存在、且非空的预设，避免把孤儿数据写回设置。 */
function prunePresets(source: MediaProviderPresets) {
  const ids = new Set(models.value.map(item => item.id.trim()));
  return Object.fromEntries(Object.entries(source).filter(([id, list]) => ids.has(id) && list.length));
}

async function savePresets() {
  if (!provider) return;
  const { data } = await axios.put<{ data: { presets: MediaProviderPresets } }>("/api/providers/media/presets", {
    fileName: provider.fileName,
    presets: prunePresets(userPresets.value),
  });
  userPresets.value = data.data?.presets ?? {};
}

function modelTags(model: MediaProviderModel) {
  const modes = Array.isArray(model.mode) ? model.mode.flat().filter((mode): mode is string => typeof mode === "string") : [];
  return modes.map(mode => {
    if (mode === "text") return model.type === "image" ? "文生图" : "文生视频";
    const reference = /^(imageReference|videoReference|audioReference):(\d+)$/.exec(mode);
    return reference ? `${modeLabels[reference[1]!]} ×${reference[2]}` : modeLabels[mode] ?? mode;
  });
}

function editModel(index?: number) {
  modelEditorDialog.value ??= defineAsyncComponent(() => import("./modelEditorDialog.vue"));
  editingModelIndex.value = index;
  modelEditorVisible.value = true;
}

function confirmModel(model: MediaProviderModel, presets: MediaProviderPreset[]) {
  const index = editingModelIndex.value;
  const previousId = index === undefined ? undefined : models.value[index]?.id;
  if (index === undefined) models.value.push(model);
  else models.value.splice(index, 1, model);
  // ACT: 改过模型 ID 后旧 ID 的预设已无归属，跟着移除，避免留下孤儿数据。
  const next = { ...userPresets.value };
  if (previousId && previousId !== model.id) delete next[previousId];
  if (presets.length) next[model.id] = presets;
  else delete next[model.id];
  userPresets.value = next;
}

function removeModel(index: number) {
  const [removed] = models.value.splice(index, 1);
  if (!removed || !userPresets.value[removed.id]) return;
  const next = { ...userPresets.value };
  delete next[removed.id];
  userPresets.value = next;
}

function exportPresets() {
  if (!provider) return;
  const payload = {
    kind: "toonflow-media-presets",
    version: 1,
    providerId: provider.id,
    providerLabel: provider.label,
    fileName: provider.fileName,
    exportedAt: new Date().toISOString(),
    modelLabels: Object.fromEntries(models.value.map(item => [item.id, item.label])),
    presets: prunePresets(userPresets.value),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${provider.id}-presets.json`;
  link.click();
  URL.revokeObjectURL(url);
  formNotice.value = `已导出 ${presetCount.value} 条自定义预设。`;
}

function pickPresetFile() {
  presetFileInput.value?.click();
}

async function importPresets(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  formError.value = "";
  formNotice.value = "";
  try {
    if (file.size > 1024 * 1024) throw new Error("预设文件不能超过 1 MB");
    const text = await file.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); }
    catch { throw new Error("预设文件不是有效的 JSON"); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("预设文件必须是 JSON 对象");
    const source = (parsed as { presets?: unknown }).presets;
    if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("预设文件缺少 presets 对象");
    const known = new Set(models.value.map(item => item.id.trim()));
    const merged: MediaProviderPresets = { ...userPresets.value };
    const skipped: string[] = [];
    let imported = 0;
    for (const [modelId, list] of Object.entries(source as Record<string, unknown>)) {
      if (!known.has(modelId) || !Array.isArray(list)) { skipped.push(modelId); continue; }
      const entries: MediaProviderPreset[] = [];
      for (const item of list) {
        const entry = item as MediaProviderPreset | undefined;
        const label = entry && typeof entry.label === "string" ? entry.label.trim() : "";
        const params = entry?.params;
        if (!label || label.length > 64 || !params || typeof params !== "object" || Array.isArray(params) || !Object.keys(params).length) continue;
        entries.push({ label, params: params as Record<string, unknown>, source: "user" });
      }
      if (!entries.length) { skipped.push(modelId); continue; }
      merged[modelId] = entries;
      imported += entries.length;
    }
    if (!imported) throw new Error("预设文件里没有可导入的条目：模型 ID 需与本供应商的模型一致");
    userPresets.value = merged;
    formNotice.value = `已导入 ${imported} 条自定义预设${skipped.length ? `，跳过 ${skipped.length} 个不匹配的模型：${skipped.join("、")}` : ""}；点「保存」后生效。`;
  } catch (error) {
    formError.value = error instanceof Error ? error.message : "导入预设失败";
  }
}

async function saveModels() {
  if (saving.value || !provider) return;
  const { id: providerId, fileName, revision } = provider;
  formError.value = "";
  formNotice.value = "";
  let configSaved = false;
  let modelSaved = false;
  try {
    const ids = new Set<string>();
    const values = models.value.map((item, index) => {
      const id = item.id.trim();
      const label = item.label.trim();
      if (!id || !label) throw new Error(`请填写第 ${index + 1} 个模型的 ID 和显示名称`);
      if (ids.has(id)) throw new Error(`模型 ID 重复：${id}`);
      ids.add(id);
      return { ...item, id, label };
    });
    if (apiKey.value.length > 8192) throw new Error("API Key 过长");
    saving.value = true;
    const nextKey = apiKey.value.trim();
    configSaved = await saveSettings(settings => {
      const configs = settings.mediaProviderConfigs as Record<string, Record<string, unknown>> | undefined;
      if (configs !== undefined && (!configs || typeof configs !== "object" || Array.isArray(configs))) throw new Error("媒体供应商配置格式无效");
      const current = configs?.[providerId];
      if (current !== undefined && (!current || typeof current !== "object" || Array.isArray(current))) throw new Error("当前供应商配置格式无效");
      if (nextKey === (current?.apiKey ?? "")) return;
      return { mediaProviderConfigs: { ...configs, [providerId]: { ...current, apiKey: nextKey } } };
    });
    const { data } = await axios.put<{ data: MediaProvider }>("/api/providers/media/save", {
      fileName, revision, models: values,
    });
    modelSaved = true;
    // ACT: 自定义预设不在供应商 ts 里，走单独接口；先存模型再存预设，失败时能明确区分是哪一步。
    await savePresets();
    invalidateNodeModels("media");
    emit("saved", data.data);
    visible.value = false;
  } catch (error) {
    const message = axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : "保存失败，请重试";
    formError.value = modelSaved
      ? `模型已保存，但自定义预设未保存：${message}。请重试保存。`
      : configSaved ? `连接配置已保存，模型未保存：${message}。模型修改已保留，请重试。` : message;
  } finally {
    saving.value = false;
  }
}
</script>

<style lang="scss" scoped>
.providerEditor {
  max-height: 65dvh;
  padding: 8px 4px;
  overflow-y: auto;
  overscroll-behavior: contain;

  .providerReadme { margin-bottom: 20px; }

  .modelHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;

    h4 { margin: 0; }

    .headerActions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  }

  .modelList {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .modelCard {
      .topInfo {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;

        .modelNameWrap {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;

          .modelInfo {
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 0;
            overflow-wrap: anywhere;

            .modelName { font-size: 15px; font-weight: 600; }
            .modelId { align-self: flex-start; }
          }
        }

        .actionButtons {
          display: flex;
          flex-shrink: 0;
          margin-left: auto;
        }
      }

      .modelTags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 16px;
      }
    }
  }
}

.formError { margin-top: 16px; }
</style>
