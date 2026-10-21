# Pakistan tax calculation register

Rule version: `PK-2026-10-21.1`. Official sources checked 21 October 2026. Supported tax years: 2026 (1 July 2025–30 June 2026) and 2027 (1 July 2026–30 June 2027). A supported year is not a claim that every tax situation is supported. Cash receipts drive this book; accrued or retained overseas amounts need separate review.

## Authorities

- [FBR Income Tax Ordinance, consolidated 30 June 2026](https://download1.fbr.gov.pk/Docs/2026724177725705IncomeTaxOrdinanace2001.pdf): operative sections and schedules; footnotes distinguish replaced text from current law.
- [FBR TY2027 withholding rate card](https://download1.fbr.gov.pk/Docs/202681113864992WithholdingTaxRatesCard2027.pdf), page 9, sections 154A and 154B.
- [FBR TY2026 rate card](https://download1.fbr.gov.pk/Docs/20258181281745641WHT-RateCard.pdf), section 154A. The non-ATL column must not override Tenth Schedule rule 10(ca). No blanket non-ATL doubling is implemented for 154A.
- [FBR source index](https://urdu.fbr.gov.pk/Categ/Income-Tax-Ordinance/326/1000) and [rate-card index](https://www.fbr.gov.pk/withholding-taxes-rate-card/174298/174301).

## Implemented federal calculations

### Export of services: section 154A

Gross realized proceeds × 0.25% for qualifying IT/software/ITeS exports with PSEB registration and certification; 1% in other covered service-export cases. First Schedule Part III Division IVA extends the concession through TY2029 in the 2026 amendment; this release deliberately enables only TY2026/2027. Authorized-dealer realization and bank tax-base evidence must be confirmed. Actual cash settlement rates are not asserted to be statutory currency-conversion rates; the user supplies the gross realized tax base reconciled under section 71.

Section 154A(2) final treatment depends on the income return, required withholding statements, applicable sales-tax returns, no foreign tax credit and no election out of final treatment. The sales-return condition's exception for clause (1)(a) qualifying PSEB IT exports is respected. Unregistered IT receipts use the other-services condition. Unsupported or unconfirmed cases show a modeled reserve and block a final liability. No inference of eligibility is made from Payoneer/Wise, a foreign invoice or a bank account label. Expenses do not reduce final-tax export bases.

### Domestic individual business

First Schedule Part I Division I (non-salaried individuals), both supported years:

| Taxable profit PKR | Tax |
| --- | --- |
| up to 600,000 | 0 |
| 600,000–1,200,000 | 15% above 600,000 |
| 1,200,000–1,600,000 | 90,000 + 20% above 1,200,000 |
| 1,600,000–3,200,000 | 170,000 + 30% above 1,600,000 |
| 3,200,000–5,600,000 | 650,000 + 40% above 3,200,000 |
| above 5,600,000 | 1,610,000 + 45% above 5,600,000 |

Taxable-profit scenario = domestic gross − domestic payment fees − explicitly claimed business expenses. A user's deductible flag is a declaration, not legal verification. Section 20–21 allowability, apportionment, capitalization and depreciation need review. The simple-business and deductions-reviewed gates are required. Section 4AB adds 10% of slab tax where business taxable profit exceeds PKR 10m. Salary/mixed profiles are blocked; salary surcharge exemptions must not be applied to this business-only scenario. Negative profit is floored at zero; no loss carry-forward is claimed.

### Withholding and mixed regimes

Entered Pakistan tax paid is tracked by regime/year. The additional modeled reserve is the sum of each regime's positive shortfall; excess export withholding cannot silently cancel domestic tax. No automated refund or foreign credit. Mixed domestic/export records produce separate scenarios and a review gate. Invoice status does not affect received income or tax.

## Visible exclusions and required review

- Provincial service sales tax: Punjab/PRA, Sindh/SRB, KP/KPRA, Balochistan/BRA and ICT/FBR. Classification, place of supply, export exemptions and registration conditions vary; no universal rate is guessed. Links are in the product. AJK/GB is always blocked for specialist review.
- Salary, investments, dividends, property, capital gains, foreign income/credits, non-residency, treaties, entities/AOPs and special exemptions are outside automated liability.
- Social media: TY2027 section 154B withholding at 5% ATL / 10% non-ATL is shown as a review note, not rolled into 154A or assumed final tax. TY2026 social-media receipts are also review-only. The `other` category is always review-only.
- Super tax section 4C and turnover/minimum tax section 113: high-income/turnover cases at PKR 100m are conservatively gated; no super-tax result is fabricated.
- Advance tax section 147 schedules, penalties/default surcharge, charitable/pension credits, personal Zakat allowances, depreciation, prior-year losses and wealth-statement section 116 reconciliation are not calculated. No official filing deadline is assumed because extensions change.

The filing package is a review worksheet, ledger and checklist. It is not an official FBR form, an IRIS import or a claim that taxes have been filed. Professional review remains outstanding. Changes in law require a new rule version and boundary tests before adding support for later years.
