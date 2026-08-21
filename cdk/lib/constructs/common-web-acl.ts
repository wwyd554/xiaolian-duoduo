import { CfnIPSet, CfnWebACL, CfnWebACLProps } from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

export interface CommonWebAclProps {
  scope: 'REGIONAL' | 'CLOUDFRONT';
  allowedIpV4AddressRanges: string[] | null;
  allowedIpV6AddressRanges: string[] | null;
  allowedCountryCodes: string[] | null;
  resourceNamePrefix?: string; // リソース名のプレフィックス
}

export class CommonWebAcl extends Construct {
  public readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: CommonWebAclProps) {
    super(scope, id);

    const rules: CfnWebACLProps['rules'] = [];

    const generateIpSetRule = (
      priority: number,
      name: string,
      ipSetArn: string
    ) => ({
      priority,
      name,
      action: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: name,
      },
      statement: {
        ipSetReferenceStatement: {
          arn: ipSetArn,
        },
      },
    });

    // リソース名にプレフィックスを追加するための変数
    const prefix = props.resourceNamePrefix || '';

    if (props.allowedIpV4AddressRanges && props.allowedIpV4AddressRanges.length > 0) {
      const wafIPv4Set = new CfnIPSet(this, `IPv4Set${id}`, {
        ipAddressVersion: 'IPV4',
        scope: props.scope,
        addresses: props.allowedIpV4AddressRanges,
        name: `${prefix}IPv4Set${id}`,  // 環境識別子をリソース名に含める
      });
      rules.push(generateIpSetRule(1, `${prefix}IpV4SetRule${id}`, wafIPv4Set.attrArn));
    }

    if (props.allowedIpV6AddressRanges && props.allowedIpV6AddressRanges.length > 0) {
      const wafIPv6Set = new CfnIPSet(this, `IPv6Set${id}`, {
        ipAddressVersion: 'IPV6',
        scope: props.scope,
        addresses: props.allowedIpV6AddressRanges,
        name: `${prefix}IPv6Set${id}`,  // 環境識別子をリソース名に含める
      });
      rules.push(generateIpSetRule(2, `${prefix}IpV6SetRule${id}`, wafIPv6Set.attrArn));
    }

    if (props.allowedCountryCodes && props.allowedCountryCodes.length > 0) {
      rules.push({
        priority: 3,
        name: `${prefix}GeoMatchSetRule${id}`,  // 環境識別子をリソース名に含める
        action: { allow: {} },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: `${prefix}FrontendWebAcl`,  // メトリック名にもプレフィックスを追加
          sampledRequestsEnabled: true,
        },
        statement: {
          geoMatchStatement: {
            countryCodes: props.allowedCountryCodes,
          },
        },
      });
    }

    const webAcl = new CfnWebACL(this, `WebAcl${id}`, {
      defaultAction: { block: {} },
      name: `${prefix}WebAcl${id}`,  // 環境識別子をリソース名に含める
      scope: props.scope,
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        sampledRequestsEnabled: true,
        metricName: `WebAcl${id}`,
      },
      rules: rules,
    });
    this.webAclArn = webAcl.attrArn;
  }
}
