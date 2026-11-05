# 第三方来源与许可

## AWS 销售陪练样例

本项目在 `aws-samples/sample-ai-sales-roleplay` 的基础上进行产品化改造，原样例许可保留在根目录 `LICENSE`（MIT No Attribution / MIT-0）。`cdk/` 保留原 AWS 实现作为参考；当前运行后端为 `server/`。

## Agent Blueprint 参考组件

模型调用底座（`server/app/agents/llm.py`）等实现参考了本地 Agent Blueprint 组件库中的 `scaffold/agent.py`。该参考库的完整工作副本不作为当前产品依赖发布，其许可声明保留如下：

MIT License

Copyright (c) 2024 Hubo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
