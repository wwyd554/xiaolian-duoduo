import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

/**
 * PDF資料保存用ストレージを作成するConstruct
 */
export interface PdfStorageConstructProps {
  resourceNamePrefix?: string;
}

export class PdfStorageConstruct extends Construct {
  /** S3バケット */
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: PdfStorageConstructProps = {}) {
    super(scope, id);

    // PDF資料保存用S3バケット
    this.bucket = new s3.Bucket(this, 'PdfStorageBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // パブリックアクセスを禁止
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 開発環境のため、削除可能に設定
      autoDeleteObjects: true, // スタック削除時にオブジェクトも削除
      enforceSSL: true,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST],
          allowedOrigins: ['*'], // クロスオリジンリクエストを許可（署名付きURLで安全に制御）
          maxAge: 3600,
        },
      ],
      // サーバーサイド暗号化を有効化
      encryption: s3.BucketEncryption.S3_MANAGED,
      // 一時アップロードファイルの自動削除ルール
      lifecycleRules: [
        {
          id: 'DeleteTempUploads',
          prefix: 'scenarios/temp-',
          expiration: cdk.Duration.days(1),
          enabled: true,
        },
      ],
    });

    // SSL必須のバケットポリシーを追加
    this.bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'DenyInsecureConnections',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:*'],
        resources: [this.bucket.bucketArn, `${this.bucket.bucketArn}/*`],
        conditions: {
          Bool: {
            'aws:SecureTransport': 'false'
          }
        }
      })
    );


  }
}
