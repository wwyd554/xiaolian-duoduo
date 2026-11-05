# 销练多多：销售业务标准的开源来源与采用建议

核验日期：2026-11-05。范围：GitHub 上的销售辅导量表、异议处理流程、评分及复练实现；通过实际文件和许可证核查，不以 README 功能宣称代替实现核查。

## 结论

有可用材料。建议采用 **LeadMagic 的行为评分量表 + Sales-Coach 的分项/权重分离 + zhixun 的中文证据与复练字段**，形成销练多多自己的通用训练标准。

这些是开源作者整理的模板和参考实现，未找到足以证明它们是行业认证标准、或能直接替代立项报告中企业销售五步法的证据。可以减少从零编写的工作，但产品事实、企业禁语、考核门槛仍需配置和校准。

已整理中文适配稿：[通用销售陪练评分标准 v0.1](./rubric-v0.1.md)。后续开发已形成 `xiaolian-sales-core / 1.0.0`，接入评分服务、报告展示和弱项复练，详见 [实施记录](../../construction/business-rubric-v1-2026-11-05.md)。研究稿中的人工审核及业务验收目标不代表全部已经实现。

## 1. 主要采用：LeadMagic / gtm-skills

固定版本：`2b7ec0f9e7044f46e4c77b536f486303fd863e28`。

- [Call Coaching Rubric](https://github.com/LeadMagic/gtm-skills/blob/2b7ec0f9e7044f46e4c77b536f486303fd863e28/skills/management-leadership/sales-coaching/references/call-coaching-rubric.md)：七个维度，分别定义 1、3、5 分的行为；需求探索、价值表达、异议处理、下一步最适合我们。
- [Call Coaching Form](https://github.com/LeadMagic/gtm-skills/blob/2b7ec0f9e7044f46e4c77b536f486303fd863e28/skills/management-leadership/sales-coaching/templates/call-coaching-form.md)：评分备注、保留一个有效行为、改进一个行为、下次实践承诺。
- [Objection Handling](https://github.com/LeadMagic/gtm-skills/blob/2b7ec0f9e7044f46e4c77b536f486303fd863e28/skills/sales-revops/objection-handling/SKILL.md)：价格/价值、时机、竞品、决策权限、现状、信任/风险六类异议；AER 流程为认可顾虑、探究原因、用事实或新角度回应。
- [MIT License](https://github.com/LeadMagic/gtm-skills/blob/2b7ec0f9e7044f46e4c77b536f486303fd863e28/LICENSE)；[LICENSE-NOTES](https://github.com/LeadMagic/gtm-skills/blob/2b7ec0f9e7044f46e4c77b536f486303fd863e28/LICENSE-NOTES.md)。版权人：2026 LeadMagic LLC。

本地原文位于 `upstream/leadmagic/`，保留许可及原作者署名。技能文件只作研究文献保存为 `objection-handling.reference.md`，没有安装或执行。原文提及的第三方方法、书籍和课程并不因此获得 MIT 授权；不打包第三方教材。

适配时必须处理：

- 原量表没有总分权重、合格线、2/4 分锚点或“不适用/证据不足”规则。
- 无会前材料和 CRM 接入时，不评“准备充分”“CRM 更新”。
- 发言占比依赖真实语音时长和任务类型；不把字数占比当时长，不用统一的 40% 阈值扣分。
- “没有预算可能是没看到价值”只是待验证假设，也可能确实没有预算。
- 不把示例 ROI、客户案例、竞品优势当我们已经拥有的事实。

## 2. 实现结构采用：Yz613 / Sales-Coach

固定版本：`5b07fc12b7dc6ffa77f5969d6ec67ae78f20897c`。

- [评估提示与输出结构](https://github.com/Yz613/Sales-Coach/blob/5b07fc12b7dc6ffa77f5969d6ec67ae78f20897c/prompts/system_prompt.md)：按通话阶段评估、引用原话及时间位置、给出下次优先改进动作。
- [权重与程序计算](https://github.com/Yz613/Sales-Coach/blob/5b07fc12b7dc6ffa77f5969d6ec67ae78f20897c/src/lib/scoreWeights.ts)：单项分数与权重分离，总分由程序加权；权重高不能反向抬高单项分。
- [评分单模型](https://github.com/Yz613/Sales-Coach/blob/5b07fc12b7dc6ffa77f5969d6ec67ae78f20897c/src/lib/scorecardModel.ts)；[评估输出 schema](https://github.com/Yz613/Sales-Coach/blob/5b07fc12b7dc6ffa77f5969d6ec67ae78f20897c/src/lib/ai/evaluationSchema.ts)。
- [MIT License](https://github.com/Yz613/Sales-Coach/blob/5b07fc12b7dc6ffa77f5969d6ec67ae78f20897c/LICENSE)。版权人：2026 Yz613。

本地保存提示、权重文件和许可于 `upstream/sales-coach/`；TypeScript 文件改为 `.reference.txt`，仅作参考，不纳入构建。

不采用其全部战术与兜底：部分规则偏强硬推进；英文正则评分不适用于中文；缺项自动跳过分母可能导致总分偏高；证据字段存在不代表验证过原文。客户明确拒绝时应尊重结束，不能以强推为优秀。

## 3. 中文参考：shangyankeji / zhixun

固定版本：`b226b34577f6804afd106e2ca7495249b6ee8a17`。

- [Evaluator](https://github.com/shangyankeji/zhixun/blob/b226b34577f6804afd106e2ca7495249b6ee8a17/backend/app/agents/evaluator.py)：开场、需求、价值、异议、推进、沟通六维；原句、轮次、角色、问题、改写及训练建议字段。
- [场景种子](https://github.com/shangyankeji/zhixun/blob/b226b34577f6804afd106e2ca7495249b6ee8a17/backend/scripts/seed_scenarios_full.py)。
- [MIT License](https://github.com/shangyankeji/zhixun/blob/b226b34577f6804afd106e2ca7495249b6ee8a17/LICENSE)。版权人：2025 SYHUB；许可另存于 `upstream/zhixun/LICENSE`，未复制其应用源码。

采用“原话 → 问题原因 → 更好的表达 → 针对性复练”的组织方式。不要照搬其评分算法：当前总分对轮次和维度求平均，未使用声明权重；模型失败时默认各项 6 分；等级说明偏笼统。我们的失败状态必须是未完成评估，不能编一个及格分。

## 4. 暂不复制的候选

- [iamademar / llm-as-a-judge-sales-coach](https://github.com/iamademar/llm-as-a-judge-sales-coach)：SPIN 七维 1–5 分逐级锚点有参考价值，但核验时没有根许可证；前端 Tremor 模板许可不能推定覆盖后端评分提示。仅列链接，未复制内容。
- [Kreegs / PitchIQ](https://github.com/Kreegs/PitchIQ)：有独立规则文件，但核验时没有明确根许可证；未作为采用来源。

## 5. 对当前项目的具体改进

当前 `server/app/agents/prompts.py` 的报告提示要求模型直接给总分、多个泛化能力分和文字建议。下一版应改为：

1. 每个场景绑定标准版本、必考项、允许使用的产品事实和适用的异议；单项训练只评预先选定的能力。
2. 模型逐项判断可观察行为并返回 message ID、说话人、原话和理由；程序校验引用是否存在、角色是否正确。
3. 程序按照固定权重汇总；缺证据、转写不完整、模型失败与行为未做到分开处理。
4. 报告优先展示一条有效行为、一条改进动作和一个可重练片段。
5. 再次练习绑定上次报告、目标能力和同一规则版本，便于比较。
6. 用人工标注样本校准后再设置合格线；不把演示分数用于正式上岗认证。

本次没有实跑上述开源项目，也没有验证其模型准确率或业务效果。采用依据是文件结构、规则内容与许可核查。
