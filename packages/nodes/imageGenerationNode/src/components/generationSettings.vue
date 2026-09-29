<template>
  <el-popover trigger="click" placement="top-start" width="min(340px, calc(100vw - 24px))" :disabled="disabled" :showArrow="false" :popperStyle="{ padding: '14px' }">
    <template #reference>
      <el-button class="settingsButton" text size="small" :disabled="disabled" aria-label="图片生成设置">
        <span class="ratioShape" :style="ratioStyle(ratio)" aria-hidden="true" />
        <span>{{ ratio }} · {{ size }} · 1张</span>
        <icon-chevron-up :size="14" aria-hidden="true" />
      </el-button>
    </template>
    <div class="generationSettings nodrag nopan nowheel" @pointerdown.stop @mousedown.stop @dblclick.stop @keydown.stop @wheel.stop>
      <div class="sectionLabel">分辨率</div>
      <el-radio-group v-model="size" class="sizeOptions" :disabled="disabled" aria-label="图片分辨率">
        <el-radio-button v-for="item in sizes" :key="item" :value="item">{{ item }}</el-radio-button>
      </el-radio-group>
      <div class="sectionLabel">比例</div>
      <div class="ratioOptions" role="group" aria-label="图片比例">
        <el-button
          v-for="item in ratios"
          :key="item"
          class="ratioButton"
          :disabled="disabled"
          :aria-label="`比例 ${item}`"
          :aria-pressed="ratio === item"
          @click="ratio = item">
          <span class="ratioContent">
            <span class="ratioShape" :style="ratioStyle(item)" aria-hidden="true" />
            <span>{{ item }}</span>
          </span>
        </el-button>
      </div>
      <div class="advancedOptions">
        <div class="advancedHeader">
          <span class="sectionLabel">高级参数</span>
          <el-select
            v-model="presetLabel"
            class="presetSelect"
            size="small"
            placeholder="预设"
            :disabled="disabled"
            :teleported="false"
            aria-label="参数预设"
            @change="applyPreset">
            <el-option value="" label="清空" />
            <el-option-group v-if="builtinPresets.length" label="预置">
              <el-option v-for="item in builtinPresets" :key="`builtin-${item.label}`" :value="item.label" :label="item.label" />
            </el-option-group>
            <el-option-group v-if="customPresets.length" label="自定义">
              <el-option v-for="item in customPresets" :key="`user-${item.label}`" :value="item.label" :label="item.label" />
            </el-option-group>
          </el-select>
        </div>
        <el-input
          v-model="customParams"
          type="textarea"
          :rows="3"
          resize="none"
          spellcheck="false"
          :disabled="disabled"
          placeholder='{"参数名": 值}'
          aria-label="自定义参数 JSON" />
        <div class="advancedHint" :class="{ invalid: customState.invalid }">{{ customState.hint }}</div>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElButton, ElPopover, ElRadioGroup, ElRadioButton, ElSelect, ElOption, ElOptionGroup, ElInput } from "element-plus";
import { IconChevronUp } from "@tabler/icons-vue";
import type { NodeMediaModel } from "@toonflow/nodes-scaffold/runtime";

const props = defineProps<{ model?: NodeMediaModel; sizes: string[]; ratios: string[]; disabled?: boolean }>();
const size = defineModel<string>("size", { required: true });
const ratio = defineModel<string>("ratio", { required: true });
const customParams = defineModel<string>("customParams", { required: true });
// ACT: 预设由模型声明 —— 预置来自供应商文件，自定义来自应用设置（宿主已合并，同名以自定义为准）；
// 界面不内置任何模型专属取值；「清空」属界面行为，始终保留。
function presetValue(item: { params: Record<string, unknown> }) {
  return JSON.stringify(item.params, null, 2);
}
const paramPresets = computed(() => [
  { label: "清空", value: "" },
  ...(props.model?.presets ?? []).map(item => ({ label: item.label, value: presetValue(item) })),
]);
const builtinPresets = computed(() => (props.model?.presets ?? []).filter(item => item.source !== "user"));
const customPresets = computed(() => (props.model?.presets ?? []).filter(item => item.source === "user"));
const supportedParams = computed(() => props.model?.params ?? []);
const presetLabel = ref("");
const customState = computed(() => {
  const declared = supportedParams.value;
  const supported = declared.length ? `该模型可填：${declared.join("、")}` : "";
  const text = customParams.value.trim();
  if (!text) return { invalid: false, hint: supported ? `留空表示使用模型默认参数；${supported}` : "留空表示使用模型默认参数" };
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { return { invalid: true, hint: "JSON 格式无效" }; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { invalid: true, hint: "必须是一个 JSON 对象" };
  const keys = Object.keys(value);
  if (!keys.length) return { invalid: false, hint: "空对象，等同于留空" };
  const extra = declared.length ? keys.filter(key => !declared.includes(key)) : [];
  if (extra.length) return { invalid: true, hint: `该模型未声明这些参数：${extra.join("、")}；可填：${declared.join("、")}` };
  return { invalid: false, hint: `本次生成将传入：${keys.join("、")}` };
});

function applyPreset(label: string) {
  const preset = paramPresets.value.find(item => item.label === label);
  if (preset) customParams.value = preset.value;
}

watch([customParams, paramPresets], ([value, presets]) => {
  const preset = presets.find(item => item.value === value);
  if (preset?.label !== presetLabel.value) presetLabel.value = preset?.label ?? "";
});

function ratioStyle(value: string) {
  const [width = 1, height = 1] = value.split(":").map(Number);
  return { width: `${16 * Math.min(width / height, 1)}px`, height: `${16 * Math.min(height / width, 1)}px` };
}
</script>

<style scoped lang="scss">
.ratioShape {
  display: inline-block;
  flex-shrink: 0;
  border: 1px solid currentColor;
  border-radius: 2px;
  box-sizing: border-box;
}

.settingsButton {
  flex-shrink: 0;
  :deep(> span) { gap: 6px; }
}

.generationSettings {
  text-align: left;
  .sectionLabel {
    margin-bottom: 8px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    font-weight: 500;
  }

  .sizeOptions {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
    .el-radio-button {
      flex: 1;
      --el-radio-button-checked-bg-color: var(--el-fill-color);
      --el-radio-button-checked-text-color: var(--el-text-color-primary);
      --el-radio-button-checked-border-color: var(--el-text-color-regular);

      :deep(.el-radio-button__inner) {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--el-border-color);
        border-radius: var(--el-border-radius-base);
        box-shadow: none;

        &:hover { color: var(--el-text-color-primary); }
      }

      &.is-active :deep(.el-radio-button__inner) {
        border-color: var(--el-text-color-regular);
      }
    }
  }

  .ratioOptions {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;

    .ratioButton {
      height: 60px;
      margin: 0;
      padding: 8px 4px;
      color: var(--el-text-color-secondary);
      --el-button-bg-color: var(--el-fill-color-light);
      --el-button-hover-bg-color: var(--el-fill-color);
      --el-button-hover-text-color: var(--el-text-color-primary);
      --el-button-hover-border-color: var(--el-border-color-darker);

      &[aria-pressed="true"] {
        color: var(--el-text-color-primary);
        border-color: var(--el-text-color-regular);
        background: var(--el-fill-color);
      }

      .ratioContent {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        font-size: 12px;
      }
    }
  }

  .advancedOptions {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--el-border-color-lighter);

    .advancedHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;

      .sectionLabel { margin: 0; }
      .presetSelect { width: 140px; }
    }

    .advancedHint {
      margin-top: 6px;
      color: var(--el-text-color-secondary);
      font-size: 12px;
      line-height: 1.5;
      overflow-wrap: anywhere;

      &.invalid { color: var(--el-color-danger); }
    }
  }
}
</style>
