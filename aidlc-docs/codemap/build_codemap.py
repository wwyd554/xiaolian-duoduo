from pathlib import Path
import json,re,html
root=Path(__file__).resolve().parents[2]
out=Path(__file__).parent
nodes=[]
def n(id,name,gx,gy,h,sub,does,paths,facts,stack=None):
    x=dict(c=f'{len(nodes)+1:02}',id=id,name=name,grp=['开始一场练习','恢复可信状态','执行一轮陪练','受控调用与复盘','外部服务与呈现'][gx],gx=gx,gy=gy,h=h,sub=sub,does=does,built='<br>'.join('<code>'+html.escape(p)+'</code>' for p in paths),facts=facts)
    if stack:
        x={k:v for k,v in x.items() if k!='h'} | {'h':h,'stack':stack}
    nodes.append(x)
n('ui','陪练工作台',0,0,34,'React 19 · TypeScript · MUI 7 · Vite 8','选择场景后发送文字或转写结果，展示客户回复、情绪和目标；结束原因由后端返回。ConversationPage 同时协调语音、形象、结束与复盘跳转，是前端主要复杂度集中处。',['frontend/src/pages/ConversationPage.tsx','frontend/src/utils/practiceState.ts'],[['构建版本依据','frontend/package.json；README 的 Vite 7 已滞后'],['分析快照','2026-09-08，含未提交改动']])
n('scenario','场景与开场',0,1,20,'场景库 · 自建场景 · 场景生成','创建会话时固定场景快照，避免之后修改场景改变已经开始的练习。开场白会被补入模型上下文，但不算用户轮次。',['server/app/api/scenarios.py','server/app/api/sessions.py','server/app/harness/state.py'],[['轮数','min(场景 maxTurns, 20)'],['场景权限','scenario_access.py']])
n('auth','邀请码与鉴权',0,2,20,'JWT · 会话所有权','前端将登录凭据保存在 localStorage；后端校验用户及资源归属。语音连接也必须属于本人活跃会话。生产启动检查要求关闭开发免登录。',['frontend/src/services/LocalAuth.ts','server/app/auth/jwt.py','server/app/auth/routes.py','server/app/config.py'],[['JWT 默认有效期','30 天（配置默认值）'],['前端本地到期','保存时设为 7 天']])
n('mic','麦克风转写',0,3,27,'WebSocket → 本地 faster-whisper','浏览器上传 PCM，后端按音量与静音分段，用 CPU/int8 Whisper 识别；它是分段重识别，不是供应商原生流式 ASR。首用时懒加载模型。',['frontend/src/services/TranscribeService.ts','server/app/api/transcribe.py','server/app/services/asr.py'],[['音频','PCM16 / 16kHz / 单声道'],['静音 / 中间结果','800 ms / 1500 ms']])
n('api','API 契约',1,0,21,'fetch → FastAPI','ApiService 直连本地后端，保持部分 AWS 风格方法名和字段。不能从 PollyService 等命名推断当前仍依赖 AWS。入口挂载认证、场景、会话、分析、语音和合规路由，并返回 X-Trace-ID。',['frontend/src/services/ApiService.ts','server/app/main.py','server/app/api/sessions.py'],[['消息入口','POST /sessions/{id}/messages'],['健康检查','GET /health']])
n('state','练习状态',1,1,32,'场景快照 · revision · 终止原因','PracticeState 是服务端权威状态。模型执行后再用 BEGIN IMMEDIATE 检查会话是否已结束、轮次和 revision 是否变化，防止并发旧回复覆盖新状态。',['server/app/harness/state.py','server/app/harness/runtime.py'],[['结束原因','goals_achieved / max_turns / user_ended'],['持久化','session_states']])
n('context','上下文与记忆',1,2,36,'有来源原句 · 分角色上下文','按事实类型和说话者保留首末事实，超预算依次裁掉旧消息、摘要摘录、事实；记录省略量。NPC 默认视图去掉训练目标，但只读工具仍能取得目标，因此不构成机密隔离。',['server/app/harness/context.py','server/app/harness/memory.py'],[['默认预算','16000，UTF-8 字节上界估算'],['计费依据','供应商 usage，非本地估算']])
n('db','SQLite 持久化',1,3,32,'WAL · 业务状态 · 工作队列','一个 SQLite 库保存用户、邀请码、场景、会话、消息、报告、任务、练习状态、审计和资源限额。会话结束与复盘入队共用事务；独立连接供 Worker 使用。',['server/app/database.py'],[['建表定义','11 张表（静态计数）'],['并发模式','WAL + 显式写事务']])
n('runtime','陪练 Runtime',2,0,46,'固定工作流 + 有限工具选择','先恢复状态和预算，NPC 与实时评分并行，随后独立目标评估，再原子保存。角色接管命中确定性策略时返回客户身份澄清，保持评分，不能把零模型调用当成模型抗攻击能力。',['server/app/harness/runtime.py','server/app/services/conversation.py','server/app/harness/budget.py'],[['默认开关','HARNESS_RUNTIME_ENABLED=1'],['整轮预算','12 次模型尝试 / 120000 预留 Token']])
n('npc','客户扮演',2,1,32,'客户台词 · 原生工具循环','NPC 扮演买方，销售是 user，客户历史是 assistant。允许有限次读取资料、查训练规则、暂存事实。工具协议默认使用 tools / tool_use / tool_result；文本 JSON 协议仅保留回退。',['server/app/harness/tool_loop.py','server/app/agents/prompts.py'],[['工具往返','最多 2 次'],['请求上限','每批 2 个 / 每轮 4 个']])
n('score','实时评分',2,2,26,'情绪、建议、表情、动作','只评估销售本轮发言，更新 angerLevel、trustLevel、progressLevel，不决定目标完成。评分失败保留旧指标并标记 unavailable。已有实测发现重复预算也可能涨进度，语义评分仍需校准。',['server/app/harness/runtime.py','server/app/agents/scoring.py'],[['指标区间','1–10'],['模型输出上限','2048 Token']])
n('goal','目标证据核验',2,3,35,'独立 Evaluator · 双方完整原句','检查目标 ID、消息来源、连续完整原句。达成必须引用销售与客户发言，置信度至少 0.85；全部显式必需目标满足且 outcome=completed 才自动结束。错误证据保留旧状态。',['server/app/harness/evaluators/goal_completion.py','server/app/harness/evidence.py'],[['置信度门槛','0.85'],['无必需目标','不推断自动完成策略']])
n('tools','四个受控工具',3,0,37,'白名单 · 权限 · 暂存 · 审计','四种工具：get_scenario_context、get_session_state、retrieve_sales_knowledge、record_customer_fact。写事实需原文来源，先暂存，与成功会话事务一起提交。知识查询只检索两条内置训练规则。',['server/app/harness/tools/registry.py','server/app/harness/tools/knowledge.py','server/app/harness/hooks.py'],[['规则范围','2 条本地规则，无企业知识库'],['事实原句实测','由张经理签字。']],4)
n('llm','模型调用底座',3,1,31,'Anthropic SDK → DeepSeek','SDK 内部重试关闭，由应用统一管理退避、超时与共享预算。空输出和 max_tokens 截断视为失败。实时三类调用默认关闭 thinking，源于小样本中的评分截断问题。日志只写白名单元数据。',['server/app/agents/llm.py','server/app/harness/observability.py','server/app/config.py'],[['默认单调用尝试','3 次 / 120 秒超时'],['实时 thinking','disabled，可配置']])
n('queue','可恢复复盘队列',3,2,36,'SQLite jobs → ReviewWorker','完成会话时入队。Worker 领取任务、续租和生成报告；只有仍持有有效租约令牌的 Worker 能提交结果，旧线程不能覆盖接管者。进程重启可恢复遗留任务。',['server/app/workers/jobs.py','server/app/main.py'],[['默认租约 / 时限','30 秒 / 900 秒'],['默认最多尝试','3 次']])
n('report','复盘生成',3,3,26,'会话材料 → 模型报告 → 落库','后台读取会话材料生成报告，供历史会话查询。客户端通过状态接口了解处理进度，失败可显式重试。生成过程在数据库事务外执行，结果由租约持有者落库。',['server/app/services/report.py','server/app/api/analysis.py'],[['状态','pending / processing / completed / failed'],['结果存储','analysis_reports.report_json']])
n('provider','DeepSeek 服务',4,0,24,'仓库外的模型 API','对话、评分、目标评估和报告共享供应商接口；chat 与 reasoner 的模型名由环境变量配置，不在架构图中假设当前运行型号。此图未读取凭据或发起真实模型调用。',['server/app/agents/llm.py','server/app/config.py'],[['兼容接口','api.deepseek.com/anthropic'],['历史小样本','2026-09-05，非本次重新测试']])
n('speech','Edge 在线语音',4,1,20,'edge-tts 依赖的外部合成服务','本地适配器通过 edge-tts 请求在线语音，接收 MP3 与词边界时间戳。本地化后端仍依赖外网语音服务；faster-whisper 识别则在本机运行。',['server/app/services/tts.py','server/app/api/tts.py'],[['音色映射','Kazuha → zh-CN-XiaoxiaoNeural'],['请求超时','30 秒']])
n('avatar','播音与虚拟形象',4,2,27,'MP3 · viseme · 情绪 · 手势','前端播放语音，并由 LipSyncController、ExpressionController、AnimationController 驱动 VRM。当前中文口型通过词边界和汉字码位取模近似得到，不是精确音素对齐。',['frontend/src/services/AudioService.ts','frontend/src/components/avatar/LipSyncController.ts','frontend/src/components/avatar/ExpressionController.ts','server/app/services/tts.py'],[['近似母音','a / i / u / e / o'],['技术','three.js + @pixiv/three-vrm']])
n('results','复盘与历史',4,3,22,'练习结束后的反馈入口','展示当前会话分析状态与报告、支持失败重试。当前本地页面尚未接通独立录音文件复盘，不能将历史 AWS 上传界面视为可用本地能力。',['frontend/src/pages/ResultPage.tsx','frontend/src/pages/AudioAnalysisPage.tsx','frontend/src/services/ApiService.ts','server/app/api/analysis.py'],[['状态接口','/sessions/{id}/analysis-status'],['重试接口','/sessions/{id}/analysis-retry']])
E=[]
def e(a,b,v,s): E.append([a,b,v,s])
e('scenario','api','POST /sessions','server/app/api/sessions.py：创建会话路由；ID 为运行时生成。')
e('auth','api','sales_roleplay_auth','frontend/src/services/LocalAuth.ts：凭据存储键；不展示真实 JWT。')
e('mic','ui','{"transcript":"...","isPartial":false}','server/app/api/transcribe.py 的文档契约；省略号为协议占位。')
e('ui','api','您最希望解决的是线索分配还是跟进遗漏？','server/tests/fixtures/dialogue_regression.json：needs-discovery 合成输入。')
e('api','state','/sessions/{session_id}/practice-state','server/app/api/sessions.py：状态读取契约。')
e('api','runtime','POST /sessions/{session_id}/messages','server/app/api/sessions.py → services/conversation.py → harness/runtime.py。')
e('state','context','budget / need / objection / decision_maker / commitment','context.py 中事实分类枚举；非虚构用户数据。')
e('state','db','session_states','database.py 的表名。')
e('context','runtime','预算上限是每年五万元。','dialogue_regression.json：early-fact 的早期 NPC 合成原句；演示需保留的事实。')
e('runtime','npc','npc-conversation','runtime.py 的模型调用标签；与评分并行。')
e('runtime','score','realtime-scoring','runtime.py 的模型调用标签；与 NPC 并行。')
e('runtime','goal','goal-completion','runtime.py：收到 NPC 回复后才执行目标评估。')
e('npc','tools','retrieve_sales_knowledge','registry.py 白名单工具名，tool_loop.py 执行。')
e('tools','npc','local://training-rules/confirm-needs/v1','knowledge.py 内置规则的实际来源标识。')
e('tools','db',"status='staged' → status='committed'",'runtime.py：待提交审计与业务状态一起提交。')
e('npc','llm','max_tokens=500','runtime.py 的客户回复输出预算。')
e('score','llm','{"angerLevel":1,"trustLevel":1,"progressLevel":1}','runtime.py SCORING_SYSTEM 的实际 JSON 示例摘录，不是实测评分。')
e('goal','llm','好的，我会安排演示，但还没定具体时间。','dialogue_regression.json：goal-boundary 合成原句，不能据此判定已约见。')
e('llm','provider','{"thinking":{"type":"disabled"}}','llm.py 实时请求默认 extra_body，控制思考预算。')
e('runtime','db','goals_achieved / max_turns','runtime.py：自动结束原因，与消息、目标和状态一起持久化。')
e('runtime','queue','enqueue_review(conn, state.sessionId)','runtime.py：自动结束时入队；手动结束也由 sessions 路由入队。')
e('queue','db',"UNIQUE(type, resource_id)",'database.py：同一资源与任务类型唯一。')
e('queue','report',"type='review'",'workers/jobs.py 的实际任务类型，领取后调用 report._generate。')
e('report','llm','llm_reasoner_model','services/report.py：报告使用配置的推理模型。')
e('report','db','analysis_reports.report_json','workers/jobs.py finish：持有效租约才写入报告结果。')
e('api','speech','/polly/convert','ApiService → api/tts.py → services/tts.py → edge-tts；此边折叠本地适配器，不是浏览器直接调用供应商。')
e('speech','avatar','data:audio/mpeg;base64,','api/tts.py：服务端将音频包装成此 data URL 前缀，经前端音频服务播放。')
e('score','avatar','happy / angry / sad / relaxed / neutral','runtime.py：情绪枚举随轮响应经工作台传入形象组件，此边为逻辑数据流。')
e('db','results','processing / completed / failed','analysis.py 和前端查询契约；经 API 获取，不是浏览器直连 SQLite。')
regions=[dict(label='外部服务',of=['provider','speech'],note='虚线表示仓库外的模型与在线语音服务。图中本地适配器路径可在“代码与接口”查看。Whisper、React、three.js 等第三方库在本地模块中使用，未逐一拆成节点。')]
stats=[['系统','销练多多 · 陪练到复盘',True],['依据','2026-09-08 工作区'],['架构','20 模块 · 29 条逻辑边'],['硬上限','20 轮'],['受控工具','4 个'],['当前主体','React + FastAPI + SQLite']]
t=Path('/Users/Admin/.codex/skills/codemap/assets/template.html').read_text()
def js_array(v):
    lines=[json.dumps(x,ensure_ascii=False,separators=(',',':')) for x in v]
    return '[\n'+',\n'.join(re.sub(r'\"(c|id|name|grp|gx|gy|h|stack|sub|does|built|facts|label|of|note)\":',r'\1:',x) for x in lines)+'\n]'
a=t.index('// TEMPLATE-EXAMPLE-DATA'); b=t.index('/* ------------------------------------------------------------- geometry */')
t=t[:a]+'\n'.join('const '+k+' = '+js_array(v)+';\n' for k,v in [('STATS',stats),('NODES',nodes),('EDGES',E),('REGIONS',regions)])+'\n'+t[b:]
t=t.replace('<title>REPLACE — name the system, not the page</title>','<!doctype html>\n<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>销练多多：一句销售话术如何变成训练反馈</title>')
t=t.replace('REPLACE — one sentence naming the system and the path through it, for screen readers','销练多多从场景和语音输入，经服务端状态、陪练 Runtime、模型评估到虚拟形象与持久化复盘的交互架构地图。')
translations={'What it does':'职责与边界',"How it\'s built":'代码与接口','Measured':'代码事实 / 历史观测','Carries':'流入与流出','Pause the flow':'暂停数据流','Resume the flow':'继续数据流','Step once':'前进一步','Reset view':'重置视图','Click a block to read it':'点击模块查看职责和源码路径','Click a moving dot to inspect the data':'点击橙色圆点检查数据','Space pauses the flow':'空格暂停','Drag to pan':'拖动平移','Scroll to zoom':'滚轮缩放','Data in flight':'流动中的数据','One snippet, as it crosses':'该逻辑关系上传递的值或协议摘录','Value':'数据片段','Components':'模块索引'}
for x,y in translations.items():t=t.replace(x,y)
t=t.replace("Every value here was taken from SQLite's own documentation and source rather than invented for the diagram. Replace this line with where yours came from — it is the sentence that makes a reader trust the rest.",'片段来自当前源码、协议注释或合成测试夹具，来源逐条注明。连线是逻辑依赖与数据流，可折叠 API/适配器，不表示所有模块直接网络连接。默认值不代表已部署配置；历史观测未在本次重跑。')
t+='\n</html>\n'
(out/'codemap.html').write_text(t)
for node in nodes:
    for p in re.findall(r'<code>(.*?)</code>',node['built']):assert (root/html.unescape(p)).exists(),p
assert len(nodes)==20 and len(E)==29
print(f'Created {out / "codemap.html"}; verified all source paths.')
