import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as path from 'path';
import { Construct } from 'constructs';

/**
 * クロスリージョンパラメータ取得コンストラクトのプロパティ
 */
export interface CrossRegionParameterProps {
  /**
   * 取得するパラメータ名
   */
  readonly parameterName: string;
  
  /**
   * パラメータが存在するリージョン
   */
  readonly region: string;
  
  /**
   * カスタムリソースのタイムアウト（秒）
   * @default 30
   */
  readonly timeout?: cdk.Duration;
}

/**
 * クロスリージョンパラメータ取得コンストラクト
 * 
 * このコンストラクトは、異なるリージョンのSSMパラメータを取得するためのカスタムリソースを提供します。
 * CloudFrontとWAF Web ACLの連携において、us-east-1リージョンに作成されたWAF Web ACLのARNを
 * 他のリージョンから取得するために使用されます。
 * 
 * @example
 * ```typescript
 * // us-east-1リージョンからSSMパラメータを取得
 * const wafAclArn = new CrossRegionParameter(this, 'WafAclArn', {
 *   parameterName: '/waf/web-acl-arn',
 *   region: 'us-east-1',
 * });
 * 
 * // 取得したパラメータ値を使用
 * const distribution = new cloudfront.Distribution(this, 'Distribution', {
 *   webAclId: wafAclArn.parameterValue,
 *   // その他のプロパティ
 * });
 * ```
 */
export class CrossRegionParameter extends Construct {
  /**
   * パラメータ値
   */
  public readonly parameterValue: string;
  
  /**
   * パラメータARN
   */
  public readonly parameterArn?: string;
  
  /**
   * パラメータタイプ
   */
  public readonly parameterType?: string;
  
  /**
   * パラメータバージョン
   */
  public readonly parameterVersion?: number;
  
  constructor(scope: Construct, id: string, props: CrossRegionParameterProps) {
    super(scope, id);
    
    // プロパティのバリデーション
    if (!props.parameterName) {
      throw new Error('错误: 需要 parameterName 参数。\n\n' +
        '解決策:\n' +
        '1. CrossRegionParameterコンストラクトにparameterNameパラメータを指定してください。\n' +
        '   例: new CrossRegionParameter(this, "Parameter", { parameterName: "/waf/web-acl-arn", region: "us-east-1" });');
    }
    
    if (!props.region) {
      throw new Error('错误: 需要 region 参数。\n\n' +
        '解決策:\n' +
        '1. CrossRegionParameterコンストラクトにregionパラメータを指定してください。\n' +
        '   例: new CrossRegionParameter(this, "Parameter", { parameterName: "/waf/web-acl-arn", region: "us-east-1" });');
    }
    
    // カスタムリソースのLambda関数を作成
    const onEventHandler = new lambda.Function(this, 'OnEventHandler', {
      runtime: lambda.Runtime.NODEJS_22_X, // 最新の推奨LTSランタイムを使用
      handler: 'cross-region-parameter.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/custom-resources')),
      timeout: props.timeout || cdk.Duration.seconds(30),
      description: 'クロスリージョンSSMパラメータを取得するためのカスタムリソースハンドラー',
    });
    
    // Lambda関数にSSMパラメータ読み取り権限を付与
    onEventHandler.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter'],
      resources: [`arn:aws:ssm:${props.region}:${cdk.Stack.of(this).account}:parameter${props.parameterName}`],
    }));
    
    // カスタムリソースプロバイダーを作成
    const provider = new cr.Provider(this, 'Provider', {
      onEventHandler,
      logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK,
    });
    
    // カスタムリソースを作成
    const customResource = new cdk.CustomResource(this, 'Resource', {
      serviceToken: provider.serviceToken,
      properties: {
        parameterName: props.parameterName,
        region: props.region,
      },
    });
    
    // カスタムリソースからパラメータ値を取得
    this.parameterValue = customResource.getAttString('Value');
    this.parameterArn = customResource.getAttString('ARN');
    this.parameterType = customResource.getAttString('Type');
    this.parameterVersion = cdk.Token.asNumber(customResource.getAtt('Version'));
  }
}
