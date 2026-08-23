#!/bin/bash

echo ""
echo "==========================================================================="
echo "  🚀 AI销售角色扮演应用程序 部署工具                    "
echo "---------------------------------------------------------------------------"
echo "  此脚本用于从AWS CloudShell轻松部署AI销售角色扮演应用程序。"
echo "                                                                           "
echo "                                                                           "
echo "  工作内容:                                                               "
echo "  - 创建CloudFormation堆栈                                          "
echo "  - 运行CodeBuild项目                                           "
echo "  - 部署应用程序（CDK）                                     "
echo "==========================================================================="
echo ""

# 默认参数
ALLOW_SELF_REGISTER="true"
CDK_JSON_OVERRIDE="{}"
REPO_URL="https://github.com/aws-samples/sample-ai-sales-roleplay.git"
VERSION="main"

# AWS_DEFAULT_REGION 设置（带回退）
AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

# 单个模型指定参数
CONVERSATION_MODEL=""
SCORING_MODEL=""
FEEDBACK_MODEL=""
GUARDRAIL_MODEL=""
VIDEO_MODEL=""
REFERENCE_CHECK_MODEL=""

# 命令行参数解析
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --disable-self-register) ALLOW_SELF_REGISTER="false" ;;
        --cdk-json-override) CDK_JSON_OVERRIDE="$2"; shift ;;
        --repo-url) REPO_URL="$2"; shift ;;
        --version) VERSION="$2"; shift ;;
        --conversation-model) CONVERSATION_MODEL="$2"; shift ;;
        --scoring-model) SCORING_MODEL="$2"; shift ;;
        --feedback-model) FEEDBACK_MODEL="$2"; shift ;;
        --guardrail-model) GUARDRAIL_MODEL="$2"; shift ;;
        --video-model) VIDEO_MODEL="$2"; shift ;;
        --reference-check-model) REFERENCE_CHECK_MODEL="$2"; shift ;;
        --help) 
            echo "使用方法: $0 [选项]"
            echo ""
            echo "通用选项:"
            echo "  --disable-self-register      禁用自助注册"
            echo "  --repo-url URL               指定GitHub仓库URL"
            echo "  --version VERSION            指定要部署的分支/标签 (默认: main)"
            echo "  --cdk-json-override JSON     CDK配置的JSON覆盖"
            echo ""
            echo "区域设置:"
            echo "  请通过 AWS_DEFAULT_REGION 环境变量指定部署区域。"
            echo "  未设置时默认使用 us-east-1。"
            echo "  示例: export AWS_DEFAULT_REGION=ap-northeast-1"
            echo ""
            echo "单个模型指定选项:"
            echo "  --conversation-model MODEL   指定对话模型"
            echo "  --scoring-model MODEL        指定评分模型"
            echo "  --feedback-model MODEL       指定反馈模型"
            echo "  --guardrail-model MODEL      指定护栏模型"
            echo "  --video-model MODEL          指定视频分析模型"
            echo "  --reference-check-model MODEL 指定参考核对模型"
            echo ""
            echo "模型示例:"
            echo "  global.anthropic.claude-haiku-4-5-20251001-v1:0"
            echo "  global.anthropic.claude-sonnet-4-5-20250929-v1:0"
            echo "  global.amazon.nova-2-lite-v1:0"
            exit 0
            ;;
        *) echo "未知参数: $1"; echo "如需显示帮助请使用 --help"; exit 1 ;;
    esac
    shift
done

echo "将按以下配置开始部署:"
echo "- 自助注册: $ALLOW_SELF_REGISTER"
echo "- 部署区域: $AWS_DEFAULT_REGION"
echo "- 仓库URL: $REPO_URL"
echo "- 版本/分支: $VERSION"

# 显示单个模型指定
if [[ -n "$CONVERSATION_MODEL" || -n "$SCORING_MODEL" || -n "$FEEDBACK_MODEL" || -n "$GUARDRAIL_MODEL" || -n "$VIDEO_MODEL" || -n "$REFERENCE_CHECK_MODEL" ]]; then
    echo "- 单个模型指定:"
    [[ -n "$CONVERSATION_MODEL" ]] && echo "  - 对话模型: $CONVERSATION_MODEL"
    [[ -n "$SCORING_MODEL" ]] && echo "  - 评分模型: $SCORING_MODEL"
    [[ -n "$FEEDBACK_MODEL" ]] && echo "  - 反馈模型: $FEEDBACK_MODEL"
    [[ -n "$GUARDRAIL_MODEL" ]] && echo "  - 护栏模型: $GUARDRAIL_MODEL"
    [[ -n "$VIDEO_MODEL" ]] && echo "  - 视频分析模型: $VIDEO_MODEL"
    [[ -n "$REFERENCE_CHECK_MODEL" ]] && echo "  - 参考核对模型: $REFERENCE_CHECK_MODEL"
fi

if [[ "$CDK_JSON_OVERRIDE" != "{}" ]]; then
    echo "- CDK配置覆盖: $CDK_JSON_OVERRIDE"
fi

echo ""
read -p "是否继续？ (y/N): " answer
case ${answer:0:1} in
    y|Y )
        echo "开始部署..."
        ;;
    * )
        echo "已取消部署"
        exit 1
        ;;
esac

# 模板验证
aws cloudformation validate-template --template-body file://deploy.yml > /dev/null 2>&1
if [[ $? -ne 0 ]]; then
    echo "模板验证失败"
    exit 1
fi

# 验证模型ID的基本格式
validate_model_id() {
    local model_id="$1"
    local model_type="$2"
    
    if [[ -z "$model_id" ]]; then
        return 0  # 为空时跳过
    fi
    
    # 基本Bedrock模型ID格式检查（region.provider.model:version）
    if [[ ! "$model_id" =~ ^[a-z-]+\.[a-z]+\.[a-z0-9.-]+:[0-9]+$ ]]; then
        echo "警告: $model_type 模型ID '$model_id' 的格式可能不正确"
        echo "  预期格式: region.provider.model-name:version"
        echo "  示例: global.anthropic.claude-haiku-4-5-20251001-v1:0"
        echo ""
        read -p "是否仍要继续？ (y/N): " confirm
        case ${confirm:0:1} in
            y|Y ) return 0 ;;
            * ) echo "已取消部署"; exit 1 ;;
        esac
    fi
    
    return 0
}

# 从单个模型指定生成CDK JSON覆盖（因Global CRIS无需区域分支）
generate_model_override_json() {
    local model_override="{}"
    
    # 构建bedrockModels的覆盖
    if [[ -n "$CONVERSATION_MODEL" || -n "$SCORING_MODEL" || -n "$FEEDBACK_MODEL" || -n "$GUARDRAIL_MODEL" || -n "$VIDEO_MODEL" || -n "$REFERENCE_CHECK_MODEL" ]]; then
        model_override=$(jq -n '{
            "context": {
                "default": {
                    "bedrockModels": {}
                }
            }
        }')
        
        # 将指定模型平铺设置
        [[ -n "$CONVERSATION_MODEL" ]] && model_override=$(echo "$model_override" | jq --arg model "$CONVERSATION_MODEL" '.context.default.bedrockModels.conversation = $model')
        [[ -n "$SCORING_MODEL" ]] && model_override=$(echo "$model_override" | jq --arg model "$SCORING_MODEL" '.context.default.bedrockModels.scoring = $model')
        [[ -n "$FEEDBACK_MODEL" ]] && model_override=$(echo "$model_override" | jq --arg model "$FEEDBACK_MODEL" '.context.default.bedrockModels.feedback = $model')
        [[ -n "$GUARDRAIL_MODEL" ]] && model_override=$(echo "$model_override" | jq --arg model "$GUARDRAIL_MODEL" '.context.default.bedrockModels.guardrail = $model')
        [[ -n "$VIDEO_MODEL" ]] && model_override=$(echo "$model_override" | jq --arg model "$VIDEO_MODEL" '.context.default.bedrockModels.video = $model')
        [[ -n "$REFERENCE_CHECK_MODEL" ]] && model_override=$(echo "$model_override" | jq --arg model "$REFERENCE_CHECK_MODEL" '.context.default.bedrockModels.referenceCheck = $model')
    fi
    
    echo "$model_override"
}

# 合并现有CDK_JSON_OVERRIDE与单个模型指定
if [[ -n "$CONVERSATION_MODEL" || -n "$SCORING_MODEL" || -n "$FEEDBACK_MODEL" || -n "$GUARDRAIL_MODEL" || -n "$VIDEO_MODEL" || -n "$REFERENCE_CHECK_MODEL" ]]; then
    echo "正在从单个模型指定生成CDK配置..."
    
    # 模型ID验证
    validate_model_id "$CONVERSATION_MODEL" "对话用"
    validate_model_id "$SCORING_MODEL" "评分用"
    validate_model_id "$FEEDBACK_MODEL" "反馈用"
    validate_model_id "$GUARDRAIL_MODEL" "护栏用"
    validate_model_id "$VIDEO_MODEL" "视频分析用"
    validate_model_id "$REFERENCE_CHECK_MODEL" "参考核对用"
    
    MODEL_OVERRIDE_JSON=$(generate_model_override_json)
    
    # 与现有CDK_JSON_OVERRIDE整合
    if [[ "$CDK_JSON_OVERRIDE" != "{}" ]]; then
        # 合并现有配置与新的模型配置
        CDK_JSON_OVERRIDE=$(echo "$CDK_JSON_OVERRIDE" | jq --argjson models "$MODEL_OVERRIDE_JSON" '. * $models')
    else
        CDK_JSON_OVERRIDE="$MODEL_OVERRIDE_JSON"
    fi
    
    echo "生成的CDK配置覆盖: $CDK_JSON_OVERRIDE"
fi

StackName="AIRoleplayDeployStack"

# 部署CloudFormation堆栈
echo "开始部署CloudFormation堆栈..."
aws cloudformation deploy \
  --stack-name $StackName \
  --template-file deploy.yml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    AllowSelfRegister=$ALLOW_SELF_REGISTER \
    BedrockRegion="$AWS_DEFAULT_REGION" \
    CdkJsonOverride="$CDK_JSON_OVERRIDE" \
    RepoUrl="$REPO_URL" \
    Version="$VERSION"

echo "正在等待堆栈创建完成..."
echo "注意: 此堆栈包含用于CDK部署的CodeBuild项目。"
spin='-\|/'
i=0
while true; do
    status=$(aws cloudformation describe-stacks --stack-name $StackName --query 'Stacks[0].StackStatus' --output text 2>/dev/null)
    if [[ "$status" == "CREATE_COMPLETE" || "$status" == "UPDATE_COMPLETE" ]]; then
        break
    elif [[ "$status" == "ROLLBACK_COMPLETE" || "$status" == "DELETE_FAILED" || "$status" == "CREATE_FAILED" ]]; then
        echo "堆栈创建失败: $status"
        exit 1
    fi
    printf "\r${spin:i++%${#spin}:1}"
    sleep 1
done
echo -e "\n已完成。\n"

# 获取堆栈的输出信息
outputs=$(aws cloudformation describe-stacks --stack-name $StackName --query 'Stacks[0].Outputs')
projectName=$(echo $outputs | jq -r '.[] | select(.OutputKey=="ProjectName").OutputValue')

if [[ -z "$projectName" ]]; then
    echo "获取CodeBuild项目名称失败"
    exit 1
fi

echo "开始CodeBuild项目 $projectName ..."
buildId=$(aws codebuild start-build --project-name $projectName --query 'build.id' --output text)

if [[ -z "$buildId" ]]; then
    echo "CodeBuild项目启动失败"
    exit 1
fi

echo "正在等待CodeBuild项目完成..."
echo "构建ID: $buildId"
while true; do
    buildStatus=$(aws codebuild batch-get-builds --ids $buildId --query 'builds[0].buildStatus' --output text)
    if [[ "$buildStatus" == "SUCCEEDED" || "$buildStatus" == "FAILED" || "$buildStatus" == "STOPPED" ]]; then
        break
    fi
    printf "."
    sleep 10
done
echo -e "\nCodeBuild项目状态: $buildStatus"

if [[ "$buildStatus" == "SUCCEEDED" ]]; then
    echo "部署已成功完成！"
    
    # 获取构建日志
    buildDetail=$(aws codebuild batch-get-builds --ids $buildId --query 'builds[0].logs.{groupName: groupName, streamName: streamName}' --output json)
    logGroupName=$(echo $buildDetail | jq -r '.groupName')
    logStreamName=$(echo $buildDetail | jq -r '.streamName')
    
    echo "日志信息:"
    echo "- 组名: $logGroupName"
    echo "- 流名: $logStreamName"
    
    # 提取CDK应用程序的URL
    logs=$(aws logs get-log-events --log-group-name $logGroupName --log-stream-name $logStreamName)
    CloudFrontURL=$(echo "$logs" | grep -o 'CloudFrontURL = [^ ]*' | cut -d' ' -f3 | tr -d '\n,')
    
    if [[ -n "$CloudFrontURL" ]]; then
        echo -e "\n🌐 应用程序URL: $CloudFrontURL"
    else
        echo -e "\n未找到应用程序URL。请查看日志。"
    fi
else
    echo "部署失败。请查看CodeBuild日志。"
fi
