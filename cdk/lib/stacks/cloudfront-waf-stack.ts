import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CommonWebAcl } from '../constructs/common-web-acl';

interface CloudFrontWafStackProps extends StackProps {
  allowedIpV4AddressRanges: string[] | null;
  allowedIpV6AddressRanges: string[] | null;
  allowedCountryCodes: string[] | null;
  envId?: string; // 環境識別子
}

export class CloudFrontWafStack extends Stack {
  public readonly webAclArn: CfnOutput;
  public readonly webAcl: CommonWebAcl;

  constructor(scope: Construct, id: string, props: CloudFrontWafStackProps) {
    super(scope, id, props);

    // 環境識別子を使ってリソース名を構築
    const resourcePrefix = props.envId ? `${props.envId}-` : '';

    const webAcl = new CommonWebAcl(this, `WebAcl${id}`, {
      scope: 'CLOUDFRONT',
      allowedIpV4AddressRanges: props.allowedIpV4AddressRanges,
      allowedIpV6AddressRanges: props.allowedIpV6AddressRanges,
      allowedCountryCodes: props.allowedCountryCodes,
      resourceNamePrefix: resourcePrefix, // リソース名のプレフィックスとして環境IDを使用
    });

    const prefix = props?.envId ? `${props.envId}-` : '';

    this.webAclArn = new CfnOutput(this, 'WebAclId', {
      value: webAcl.webAclArn,
      exportName: `${prefix}WebAclId`,
    });

    this.webAcl = webAcl;
  }
}
