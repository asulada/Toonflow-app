import { Router } from "express";
import u from "@/utils";
import { validateFields } from "@/lib/middleware";
import { success } from "@/lib/responseFormat";

// ACT: 用户自定义一键预设不写进供应商 ts，单独存应用设置，因此单开一条读写路由。
export default Router()
  .get("/", validateFields({ fileName: u.mediaProvider.mediaProviderFileSchema }, "query"), async (req, res) => {
    res.json(success(await u.mediaProvider.readMediaProviderPresets(String(req.query.fileName))));
  })
  .put("/", validateFields({
    fileName: u.mediaProvider.mediaProviderFileSchema,
    presets: u.mediaProvider.mediaPresetsSchema,
  }), async (req, res) => {
    res.json(success(await u.mediaProvider.saveMediaProviderPresets(req.body.fileName, req.body.presets)));
  });
