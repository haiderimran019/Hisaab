/* The current public preview has no checkout or paid feature gates.
   These are product entitlements; financial and licence verification functions
   remain unchanged. Existing workspace/schema limits still apply. */
import {LIMITS,limitsFor,type LicenseStatus,type Limits} from './license';
export const FREE_PREVIEW=true;
export const previewLimits=(status:LicenseStatus):Limits=>FREE_PREVIEW?{...LIMITS.accountant}:limitsFor(status);
export const previewLabel='Free preview';
