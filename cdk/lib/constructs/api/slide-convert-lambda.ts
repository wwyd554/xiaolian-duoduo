import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as path from 'path';

/**
 * PDF→スライド画像変換Lambda関数を作成するConstructのプロパティ
 */
export interface SlideConvertLambdaConstructProps {
  /** シナリオテーブル */
  scenariosTable: dynamodb.ITable;
  /** スライド画像保存用S3バケット */
  slideBucket: s3.IBucket;
}

/**
 * PDF→スライド画像変換Lambda関数を作成するConstruct
 * コンテナLambda（poppler依存のため）
 */
export class SlideConvertLambdaConstruct extends Construct {
  public readonly function: lambda.DockerImageFunction;

  constructor(scope: Construct, id: string, props: SlideConvertLambdaConstructProps) {
    super(scope, id);

    this.function = new lambda.DockerImageFunction(this, 'Function', {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, '../../../lambda/slideConvert')
      ),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        SLIDE_BUCKET: props.slideBucket.bucketName,
        SCENARIOS_TABLE: props.scenariosTable.tableName,
      },
      description: 'PDF→スライド画像変換Lambda関数',
      reservedConcurrentExecutions: 5,
    });

    // S3アクセス権限
    props.slideBucket.grantReadWrite(this.function);
    // DynamoDBアクセス権限（UpdateItemのみに最小化）
    this.function.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:UpdateItem'],
      resources: [props.scenariosTable.tableArn],
    }));
  }
}
