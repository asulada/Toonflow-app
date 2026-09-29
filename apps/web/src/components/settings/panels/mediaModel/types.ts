export type MediaProviderModel = {
  id: string;
  label: string;
  type: "text" | "image" | "video" | "audio";
  [key: string]: unknown;
};

/** builtin = 随供应商 ts 一起发布的预置预设；user = 用户在本机界面添加的自定义预设。 */
export type MediaProviderPreset = {
  label: string;
  params: Record<string, unknown>;
  source?: "builtin" | "user";
};

/** 某个供应商的用户自定义预设，按模型 ID 分组；存在应用设置里，不写进 ts。 */
export type MediaProviderPresets = Record<string, MediaProviderPreset[]>;

export type MediaProvider = {
  fileName: string;
  id: string;
  label: string;
  version?: string;
  readme?: string;
  modelsUrl?: string;
  models: MediaProviderModel[];
  revision: string;
  loadError?: string;
  /** 安装接口返回：同一供应商已存在并被本次上传覆盖时为 true。 */
  replaced?: boolean;
};
