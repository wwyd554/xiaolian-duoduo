import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';

/**
 * 提案資料スライド画像保存用ストレージを作成するConstruct
 * 元PDFと変換後のスライド画像（PNG）を保存する
 */
export interface SlideStorageConstructProps {
  resourceNamePrefix?: string;
}

export class SlideStorageConstruct extends Construct {
  /** S3バケット */
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: SlideStorageConstructProps = {}) {
    super(scope, id);

    // スライド画像保存用S3バケット
    this.bucket = new s3.Bucket(this, 'SlideStorageBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
          allowedOrigins: ['*'], // TODO: 本番環境ではCloudFrontドメインに制限する
          maxAge: 3600,
        },
      ],
      encryption: s3.BucketEncryption.S3_MANAGED,
      // 一時アップロードファイルの自動削除ルール
      lifecycleRules: [
        {
          id: 'DeleteTempUploads',
          prefix: 'presentations/temp-',
          expiration: cdk.Duration.days(1),
          enabled: true,
        },
      ],
    });


  }
}
