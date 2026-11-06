# Costing Document

**Currency/region/date:** INR/India assumptions; 6 November 2026. Hosted figures
below are estimates, not quotations or actual spend. The scenario is one small
AWS Mumbai development deployment, single-AZ, running continuously for 730
hours/month.

## Scenario estimate

| Component | Published assumption | Monthly calculation | USD/month |
|---|---:|---:|---:|
| EC2 app runtime, `t4g.small`, Linux, `ap-south-1` | $0.0168/hour | 0.0168 × 730 | $12.26 |
| RDS PostgreSQL, `db.t4g.micro`, single-AZ, `ap-south-1` | $0.039/hour | 0.039 × 730 | $28.47 |
| S3 Standard evidence/backups | $0.023/GB-month | 10 GB × 0.023 | $0.23 |
| Internet egress | first 100 GB/month free | assumed 5 GB | $0.00 |
| **Estimated subtotal** | | | **$40.96** |

Using an explicit planning FX assumption of **₹84/USD**, the subtotal is
**₹3,440.64/month** before GST, taxes, support, snapshots, database I/O,
CPU-credit overage, public IPv4, monitoring, and backup retention. At 250
core transactions/day, the monthly transaction volume is 7,500; the scenario
does not claim that this infrastructure sizing has been load-tested.

Local development, Node, PostgreSQL, k6, Flyway, and test fixtures remain
**₹0 incremental spend** because they use the existing workstation. No cloud
purchase, hosted service, or subscription was made.

## Dated sources and limitations

Sources were checked 6 November 2026:

- AWS EC2 On-Demand pricing: <https://aws.amazon.com/ec2/pricing/on-demand/>
- AWS RDS for PostgreSQL pricing: <https://aws.amazon.com/rds/postgresql/pricing/>
- AWS S3 pricing: <https://aws.amazon.com/s3/pricing/>
- AWS data transfer pricing: <https://aws.amazon.com/ec2/pricing/on-demand/#Data_Transfer>
- AWS Pricing Calculator: <https://calculator.aws.amazon.com/>

The hourly rates above are planning inputs obtained from public pricing
references and should be re-entered into the AWS calculator immediately before
deployment. They are not verified invoices or a promise of future price
stability.


