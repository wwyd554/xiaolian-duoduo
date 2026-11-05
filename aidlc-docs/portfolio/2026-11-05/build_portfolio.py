from pathlib import Path
import json
import shutil
import zipfile
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.utils import ImageReader
from reportlab.lib.pagesizes import A4, landscape

ROOT = Path('/Users/Admin/Desktop/wyy/个人项目/sample-ai-sales-roleplay-main')
OUT = ROOT / 'aidlc-docs/portfolio/2026-11-05'
PDF_DIR = OUT / 'output/pdf'
ASSETS = OUT / 'assets'
TMP = OUT / 'tmp/pdfs'
for folder in (PDF_DIR, ASSETS, TMP):
    folder.mkdir(parents=True, exist_ok=True)

FONT = 'PortfolioCJK'
BOLD = 'PortfolioCJKMedium'
pdfmetrics.registerFont(TTFont(FONT, '/System/Library/Fonts/STHeiti Light.ttc', subfontIndex=0))
pdfmetrics.registerFont(TTFont(BOLD, '/System/Library/Fonts/STHeiti Medium.ttc', subfontIndex=0))
W, H = landscape(A4)
INK = HexColor('#172338')
MUTED = HexColor('#56667D')
BLUE = HexColor('#2C55DE')
SOFT = HexColor('#EEF4FF')
LINE = HexColor('#DCE4EF')
BG = HexColor('#FAFBFD')
PDF = PDF_DIR / '武禹德_销练多多_AI产品作品集.pdf'
c = canvas.Canvas(str(PDF), pagesize=(W, H), pageCompression=1)
c.setTitle('销练多多 | 武禹德 | AI 产品与智能体作品案例')
c.setAuthor('武禹德')
c.setSubject('销售陪练与沟通复盘：产品设计、实际页面、AI约束、验证与个人工作')

sources = {}
for key in ('home', 'context', 'evidence', 'real-report', 'focus-practice', 'import-preview', 'generated-draft'):
    source = Path(f'/tmp/xiaolian-portfolio-{key}.png')
    packaged = ASSETS / f'原始截图_{key}.png'
    if source.exists(): shutil.copy2(source, packaged)
    assert packaged.exists(), str(packaged)
    sources[key] = packaged

meta_source=Path('/tmp/xiaolian-portfolio-capture-meta.json')
meta_packaged=ASSETS/'截图定位.json'
if meta_source.exists(): shutil.copy2(meta_source,meta_packaged)
meta = json.loads(meta_packaged.read_text())
(ASSETS / '截图来源.json').write_text(json.dumps({
    'date': '2026-11-05', 'kind': '当前项目 EGO 浏览器真实截图，仅裁切与文档标注',
    'pages': {'home': '/', 'generated-draft': '/scenarios/generate（实际模型草稿，未保存）',
              'context': '/demo', 'evidence': '/demo?step=review&example=before',
              'import-preview': '/history 内的导入预览（模拟文字，未保存）',
              'real-report': '/result/9d031a3d-711e-4d9d-9270-01842b6e4123',
              'focus-practice': '/conversation/contract-renewal?sourceSessionId=9d031a3d-711e-4d9d-9270-01842b6e4123&criterionId=S3'},
    'limitations': '页面使用模拟案例或开发验收记录；示例分数不是能力提升、准确率或真实客户经营数据。'
}, ensure_ascii=False, indent=2)+'\n')

def crop(key, box, label):
    im = Image.open(sources[key]).convert('RGB')
    x0, y0, x1, y1 = box
    assert 0 <= x0 < x1 <= im.width and 0 <= y0 < y1 <= im.height, (key, box, im.size)
    im = im.crop(box)
    path = ASSETS / f'{label}.jpg'
    im.save(path, quality=94, optimize=True)
    return path

home = crop('home', (250, 25, 1420, 530), '01_首页描述入口')
draft = crop('generated-draft', (600, 460, 1420, 900), '02_生成草稿待确认')
f = meta['focus']
evidence = crop('evidence', (int(f['x']), int(f['y']), int(f['x']+f['width']), int(f['y']+f['height'])), '03_原话与改进依据')
import_roles = crop('import-preview', (465, 431, 1326, 884), '04_导入角色与内容核对')
report = crop('real-report', (584, 429, 1436, 853), '05_实际复盘的薄弱项建议')
focus = crop('focus-practice', (468, 91, 1320, 166), '06_新练习携带专项目标')

for name, target in [('draft', 'draft'), ('evidence', 'evidence'), ('report', 'report')]:
    hi = Path(f'/tmp/xiaolian-portfolio-{name}-detail-hi.png')
    path = ASSETS / f'高清局部_{name}.jpg'
    if hi.exists():
        Image.open(hi).convert('RGB').save(path, quality=96, optimize=True)
    if path.exists():
        if target == 'draft': draft = path
        elif target == 'evidence': evidence = path
        else: report = path

def wrap(text, width, size, font=FONT):
    lines=[]
    for paragraph in text.split('\n'):
        line=''
        for char in paragraph:
            if line and pdfmetrics.stringWidth(line+char, font, size)>width:
                if len(line)>1 and (char in '，。：；？！、）》】」”’' or line[-1] in '（《【「“‘'):
                    lines.append(line[:-1])
                    line=line[-1]+char
                else:
                    lines.append(line)
                    line=char
            else: line+=char
        lines.append(line)
    return lines

def text(value, x, y, width, size=13, leading=None, color=INK, bold=False):
    font = BOLD if bold else FONT
    c.setFillColor(color)
    c.setFont(font, size)
    leading = leading or size*1.6
    lines = wrap(value, width, size, font)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y

def panel(x,y,w,h,fill=white,stroke=LINE,r=10):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(.65)
    c.roundRect(x,y,w,h,r,stroke=1,fill=1)

def image(path,x,y,w):
    im=Image.open(path)
    h=w*im.height/im.width
    c.drawImage(ImageReader(im),x,y,width=w,height=h)
    c.setStrokeColor(LINE)
    c.setLineWidth(.6)
    c.rect(x,y,w,h,stroke=1,fill=0)
    return h

def dot(n,x,y):
    c.setFillColor(BLUE)
    c.circle(x,y,10,stroke=0,fill=1)
    c.setFillColor(white)
    c.setFont(BOLD,10)
    c.drawCentredString(x,y-3.6,str(n))

def point(n,title,body,x,y,w=250):
    dot(n,x+10,y-1)
    text(title,x+30,y-5,w-30,14.5,20,bold=True)
    bottom=text(body,x+30,y-34,w-30,12.1,19,color=MUTED)
    return bottom-20

def header(num,section,title,subtitle=None):
    c.setFillColor(BG)
    c.rect(0,0,W,H,stroke=0,fill=1)
    text('武禹德 / AI 产品与智能体作品案例',36,H-28,560,9.2,color=MUTED)
    c.setFillColor(BLUE)
    c.setFont(BOLD,9.5)
    c.drawRightString(W-36,H-28,section)
    text(title,36,H-82,W-72,27,38,bold=True)
    if subtitle: text(subtitle,36,H-116,W-72,11.5,18,color=MUTED)
    c.setStrokeColor(LINE)
    c.line(36,34,W-36,34)
    text('销练多多 · 可运行原型 · 2026.11',36,19,600,8.5,color=MUTED)
    c.setFont(FONT,8.5)
    c.drawRightString(W-36,19,f'{num:02d} / 06')

def arrow(x1,y1,x2,y2,color=BLUE):
    c.setStrokeColor(color)
    c.setLineWidth(1.2)
    c.line(x1,y1,x2,y2)
    if abs(x2-x1)>=abs(y2-y1):
        sign=1 if x2>x1 else -1
        c.line(x2,y2,x2-sign*5,y2+3)
        c.line(x2,y2,x2-sign*5,y2-3)
    else:
        sign=1 if y2>y1 else -1
        c.line(x2,y2,x2+3,y2-sign*5)
        c.line(x2,y2,x2-3,y2-sign*5)

# 1. A product case, with a real home view and a clear personal role.
header(1,'产品总览','销练多多')
text('把销售练习\n接到下一次行动',36,447,270,29,43,bold=True)
text('与 AI 模拟客户练习销售沟通，再从原话中找到下一轮要改的表达。',36,330,245,14,23,color=MUTED)
text('武禹德',36,221,240,20,28,bold=True)
text('独立项目负责人 / AI 辅助开发',36,188,250,11.8,19,color=MUTED)
text('投递方向：AI 产品经理 / 智能体产品',36,161,260,11.1,18,color=MUTED)
image(home,320,277,486)
text('当前产品首页：描述难题后生成草稿，也可从场景库进入。',320,257,486,11.1,18,color=MUTED)
for i,(title,desc) in enumerate([('明确情境','客户、目标、已知条件'),('查看依据','原话、行为判断、建议'),('带着目标再练','来源复盘与薄弱考点')]):
    x=320+i*166
    panel(x,165,155,66,SOFT)
    text(title,x+12,207,133,13,bold=True)
    text(desc,x+12,183,133,9.4,15,color=MUTED)
text('个人作品：在 AWS 开源样例基础上，完成本地化产品改造与可运行链路。',320,132,486,11.3,19,color=MUTED)
panel(36,62,W-72,43,SOFT)
text('材料中的人物、产品与对话均为模拟案例或开发验收记录。',51,78,W-102,11.5,18,color=MUTED)
c.showPage()

# 2. Decisions and product reasoning, rather than a list of screens.
header(2,'设计决策','先描述问题，再确认这一次要练什么','设计依据：演示、自测与迭代反馈；尚未开展正式样本化用户研究。')
y=440
y=point(1,'降低开始练习的门槛','用户先用一句话描述销售难题，再由 AI 草拟客户、背景与目标。',36,y,250)
y=point(2,'生成后让人确认','草稿可编辑，确认后才保存成私有场景。把事实和训练方向的控制权交给用户。',36,y,250)
y=point(3,'首页聚焦当前任务','首页保留描述入口与场景库；产品说明收在侧栏，避免占据工作区。',36,y,250)
image(draft,320,205,486)
dot(1,305,443)
arrow(315,443,326,443)
dot(2,305,332)
arrow(315,332,326,332)
text('真实模型生成的草稿，截图时尚未保存。人物与门店为模型生成的模拟设定。',320,182,486,11,18,color=MUTED)
panel(320,77,486,72,SOFT)
text('设计参考与取舍',336,126,454,13,bold=True)
text('信息组织参考 Lollipop 的描述入口、Hyperbound 的陪练流程展示；依据本项目的任务路径重组，练习时收起实时分数面板。',336,103,454,10.8,17,color=MUTED)
c.showPage()

# 3. One readable evidence card, plus the actual scoring policy.
header(3,'AI 评价设计','复盘要回答：哪句话，哪里没做到','示例：模拟客户担心“买了工具没人用”，销售却直接让客户“先试试”。')
text('项目行为量表 v1',36,442,270,15,bold=True)
criteria=[('S1','建立沟通与确认议程','10'),('S2','探索并核对需求','30'),('S3','将价值与需求对应','25'),('S4','理解并回应异议','20'),('S5','对齐下一步','15')]
for i,(sid,label,weight) in enumerate(criteria):
    yy=407-i*28
    text(sid,36,yy,28,10.8,color=BLUE,bold=True)
    text(label,69,yy,203,11.4)
    text(weight,276,yy,30,11.4,color=MUTED)
text('按本场适用项归一化计分；\n0 / 1 / 2 对应未做到、部分做到、完整做到。',36,247,270,10.9,18,color=MUTED)
point(1,'模型判断行为，程序检查依据','引用绑定消息 ID、说话人和原句；分数按固定权重计算。',36,190,270)
image(evidence,340,190,466)
dot(1,325,453)
panel(340,82,466,88,SOFT)
text('关键取舍：允许“证据不足”',356,147,434,13.2,bold=True)
text('缺少可用材料时保持未评，不补默认分。原文校验能检查引用是否存在，评分语义仍需人工标注集校准。',356,122,434,11.6,19,color=MUTED)
text('画面为预写模拟对话；报告实际调用当前评价模型生成。项目量表尚需业务校准，不作为上岗认证。',36,63,W-72,10.4,16,color=MUTED)
c.showPage()

# 4. A concrete reason to add a human confirmation step.
header(4,'真实沟通复盘','聊天和录音，也能进入同一套复盘','练习以外的需求：销售在微信聊完，或拿到一段沟通录音后，也需要找出下一步。')
image(import_roles,36,204,490)
dot(1,538,400)
dot(2,538,267)
text('实际导入确认界面（局部）。本次截图使用未保存的模拟文字。',36,180,490,10.7,17,color=MUTED)
y=439
y=point(1,'先确认谁说了什么','导入后核对销售 / 客户角色、顺序与内容，避免把发言人认错后继续评分。',551,y,252)
y=point(2,'录音先转写，再核对','上传录音由本地 Whisper 转文字，用户确认后，再进入同一套评价流程。',551,y,252)
y=point(3,'统一管理复盘记录','陪练、聊天与录音放在同一列表；支持按来源查看、重新练习和删除单条记录。',551,y,252)
panel(36,67,W-72,66,SOFT)
text('明确能力边界',52,111,190,12.8,bold=True)
text('聊天支持粘贴 / TXT，暂不支持截图 OCR；录音尚无可靠的自动说话人区分，保留人工核对步骤。',52,88,W-104,11.2,18,color=MUTED)
c.showPage()

# 5. Show the actual handoff from a report to a new focused practice.
header(5,'行动闭环','建议要能回到下一轮练习','以下取自软件续约的合成对话实跑记录，用来展示来源关联与专项复练。')
image(report,36,224,490)
dot(1,508,273)
image(focus,36,141,490)
dot(2,507,164)
text('上：实际报告中的薄弱项与“专项再练”。下：新练习显示本次专项目标。',36,119,490,10.5,17,color=MUTED)
y=438
y=point(1,'从一个薄弱项出发','先保留做对的地方，再给一个可执行动作。用户点击报告内的专项再练。',551,y,250)
y=point(2,'把来源和目标带过去','新练习关联来源会话与考点，沿用规则和场景快照。结束后可对照同一项表现。',551,y,250)
y=point(3,'区分单次表现与长期能力','规则和证据可比时才计算变化。示例评分用于解释流程，训练效果需要另行验证。',551,y,250)
text('价值主张：让复盘建议变成下一轮能练习的动作。当前已打通可运行路径，尚无真实用户训练效果数据。',36,66,W-72,11.1,18,color=MUTED)
c.showPage()

# 6. Personal contribution and maturity are explicit.
header(6,'个人工作与验证','把产品判断，落到可运行的流程里','项目角色：独立项目负责人。以 AI 辅助完成开发、调试和验收，并为范围与结果负责。')
text('我负责的产品工作',36,441,355,15.5,bold=True)
y=411
for title,body in [
    ('需求与范围','围绕销售异议，组织场景、对练、证据复盘、再练的路径；主动收起摄像头和练习中的复杂状态展示。'),
    ('AI 行为与评价','区分模拟客户、行为判断和目标判断；定义场景事实、评价锚点、版本与证据约束。'),
    ('落地与验收','推进 FastAPI / SQLite 本地实现、场景生成确认、聊天 / 录音导入、报告与专项练习；检查失败、重试、权限和删除路径。')]:
    text(title,36,y,355,12.7,bold=True)
    y=text(body,36,y-24,355,11.5,18,color=MUTED)-19

text('实现关系（简图）',430,441,375,15.5,bold=True)
nodes=[(430,379,375,37,'React / TypeScript：练习与复盘界面'),
       (430,318,375,39,'FastAPI：状态、场景快照与流程控制'),
       (430,209,375,41,'原文校验 + 固定规则计分'),
       (430,151,375,37,'SQLite：消息、报告与可重试任务')]
for x,y,w,h,label in nodes:
    panel(x,y,w,h,SOFT)
    text(label,x+13,y+h/2-4,w-26,11.7,18,bold=True)
arrow(617,379,617,359)
for i,label in enumerate(['模拟客户','行为评价','目标判断']):
    x=430+i*129
    panel(x,270,117,28,white)
    text(label,x+12,279,93,10.7,bold=True)
    arrow(x+58,317,x+58,300)
    arrow(x+58,269,x+58,252)
arrow(617,208,617,190)

panel(36,54,769,67,SOFT)
text('已经验证',51,99,155,12.4,bold=True)
text('后端 195 项自动化测试通过；已完成合成案例的模型实跑与关键页面路径检查。',51,78,341,10.7,16,color=MUTED)
text('下一步验证',430,99,335,12.4,bold=True)
text('建立人工盲评集校准评分；再做受控试点，测实际使用与培训师复核成本。',430,78,357,10.7,16,color=MUTED)
text('来源与边界：基于 AWS sample-ai-sales-roleplay 开源样例（MIT-0）改造。当前为个人原型，企业班级、人工复核与正式效果验收尚未完成。',36,158,355,9.1,14,color=MUTED)
c.showPage()
c.save()

guide = '''# 给 HR 的发送说明与 90 秒录屏脚本

作者：武禹德。目标岗位：AI 产品经理 / 智能体产品。日期：2026-11-05。

这份说明供你使用；初次联系 HR，优先发送 PDF 正文，不需要把源码、素材目录和本说明一起发过去。

## 推荐发送组合

1. 首次投递：简历 + 6 页图文 PDF + 下方的一段介绍。
2. HR 或业务面试官愿意进一步看：补一段 60-90 秒真实录屏。
3. 需要自行体验：再提供部署后的公网 HTTPS 演示链接与清晰的体验路径。

PDF 负责讲清楚问题、角色、设计判断和验证；录屏负责证明关键操作真实可运行；在线原型方便对方追问和试用。不要让阅读者第一次打开就必须注册、打开麦克风或等待完整报告生成。

## 可直接复制给 HR 的介绍

您好，我是武禹德。这是我的 AI 产品作品“销练多多”，围绕销售面对客户异议时的练习和复盘需求，在开源样例基础上进行了独立产品化改造，并用 AI 辅助完成开发与验收。

我重点做了场景生成后确认、模拟客户对练、有原话依据的行为评价，以及从薄弱项回到专项复练。附件用 6 页真实页面说明关键设计、我的工作和当前验证边界。方便的话，我也可以现场演示一轮并介绍其中的产品取舍。

## 如以邮件发送

建议标题：AI 产品作品集｜武禹德｜销练多多（销售陪练与沟通复盘）

附件只放《武禹德_销练多多_AI产品作品集.pdf》。录屏准备好后可单独补发，避免第一次塞入过多文件。

## 90 秒录屏脚本（尚未录制成视频）

| 时间 | 画面与操作 | 口播 |
| --- | --- | --- |
| 00-12 秒 | 产品首页，光标停在描述入口 | “这是我做的销练多多。销售经常知道产品，却不知道客户一说‘没必要’时怎么接。我想让他先练一遍，再从原话里找到下一轮要改的一件事。” |
| 12-30 秒 | 输入模拟销售难题，展示已生成的草稿与确认项 | “用户先描述遇到的难题，AI 草拟客户与目标。这里保留人工确认，让用户能改背景和条件，确认后才开始练习。” |
| 30-47 秒 | 左侧产品演示，切到‘看对话与复盘’ | “这段是预写模拟对话，报告实际调用当前模型生成。客户担心买了工具没人用，这种‘先试试’的回应，没有问清真正顾虑。” |
| 47-65 秒 | 展示原话、问题和下一次动作，点击‘定位这句原话’ | “复盘需要说清哪句话出了问题。系统检查引用是否出现在对应发言里，再按固定规则算分。材料不够时保持未评，评分判断仍需要人工校准。” |
| 65-82 秒 | 从真实已有报告点‘专项再练’，展示专项目标条 | “建议要接回练习。新一轮会带上来源报告和薄弱考点，而不只是重新打开一个空白对话。” |
| 82-90 秒 | 停在专项准备页或作品集最后一页 | “我负责需求、流程、AI 评价设计与 AI 辅助开发。目前可展示完整路径，下一步会通过人工盲评和受控试点验证实际效果。” |

录屏只展示关键转场和真实反馈。等待模型时可以剪掉空等并注明，不把静态示例伪装成实时生成，也不把两条样例包装成真实用户训练前后的提升。无需一开始讲框架名、测试数量和全部设置。

## 面试官想深挖时，讲这三个问题

- 为什么生成后要确认？客户、目标与事实需要可控；生成不是默认正确。
- 为什么先做证据与规则？只有“AI 给了多少分”很难解释，原话、考点、版本和计算过程需要能检查。
- 为什么要专项再练？复盘报告的价值是引导下一次行为，不只让用户阅读总结。

个人贡献应明确表述为：在开源样例基础上，主导需求和交互设计、业务评价与流程改造，使用 AI 辅助开发与验收。不要把原 AWS 样例全部表述为个人从零原创，也不要把自动化测试通过当作评分准确率。

## 公网体验链接怎么安排

当前 `http://127.0.0.1:5174` 是本地地址，HR 在自己的电脑上无法直接打开。本轮准备的是 PDF、截图和脚本，还没有完成公网部署。

建议先提供只读的‘产品演示’作为首个公网入口；需要实际对练时，再提供独立演示账号、少量体验次数和明确的费用限制。正式对外体验前关闭开发免登录、配置 HTTPS 与生产鉴权，并使用模拟数据。录音原始文件和真实客户对话不要放入公开演示环境。

不要把整个项目目录压缩发给 HR；源码库、模型凭证、数据库和个人记录都不属于初次作品展示材料。

## 本轮素材与事实说明

- PDF 采用当前页面截图，使用局部裁切和文档标注，没有生成虚构的产品界面。
- 场景草稿是本轮实际调用模型生成的，截图时未保存；聊天导入使用模拟文字，停在核对步骤，未提交。
- 软件续约报告来自现有合成对话验收记录；商户案例页的双方对话为预写示例，复盘实际调用评价模型。
- 人物、公司、产品、分数都用于演示与验收，不代表真实客户业绩、训练成效或商业使用规模。
- 视觉与信息组织曾参考 Lollipop 和 Hyperbound 的相应展示方式；业务流程结合本项目需求与迭代反馈重组。当前未做正式样本化用户研究。
'''
(OUT/'给HR的发送说明与90秒录屏脚本.md').write_text(guide)

zip_path=OUT/'output/销练多多_作品集与说明.zip'
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
    z.write(PDF,PDF.name)
    z.write(OUT/'给HR的发送说明与90秒录屏脚本.md','给HR的发送说明与90秒录屏脚本.md')

manifest={'pdf':str(PDF),'pages':6,'sizeBytes':PDF.stat().st_size,'guide':str(OUT/'给HR的发送说明与90秒录屏脚本.md'),'zip':str(zip_path),'screenshots':len(sources),'video':'仅脚本，未录制','publicDeployment':False}
(OUT/'验收与交付清单.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(manifest,ensure_ascii=False))
