# 上游代码核对快照

本目录保留本轮接入时核对的官方文件原始字节，用于追查接口和测试固定版本的 EpisodeWriter。它们不是本项目的运行依赖，工作台不会从此目录启动机器人程序。

- `teleop-source.py`、`writer-source.py`、`ipc.py`：Unitree `xr_teleoperate@817fb00c63cde15e5f24a0f8fa08e1e33ed89d3b`。
- `sim_*`、`dds_*`：Unitree `unitree_sim_isaaclab@e30c25b1dffdf92ada1d6c8c1fe9a47bdde0fecc`。
- `image_server.py`、`teleimager_README.md`：Unitree `teleimager@57cf2a40572227273fa001cd17833b755331ec97`。

许可证分别保留为 `xr_LICENSE`、`sim_LICENSE` 和 `teleimager_LICENSE`。运行校验所用的主程序和记录器原始文件 SHA-256、官方下载 URL 见 `source_manifest.json`。保留上游原有的尾部空格与换行，不对这些证据副本执行格式化；项目代码另行检查。
