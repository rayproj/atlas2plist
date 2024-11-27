把 Spine导出的 【atlas 文本格式】转换为 TexturePacker4 格式的 Cocos2d 【plist文本格式】，支持目录/单文件。

> node dist/atlas2plist 目录
>
> node dist/atlas2plist a.atlas

测试版本：Spine 3.8.75

注意：spine 导出时打包设置不能勾选【旋转】，原因是 spine 的旋转指逆时针旋转90°，tp中为顺时针。