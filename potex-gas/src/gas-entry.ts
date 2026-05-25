import { bootstrapProject, validateEnvironment } from './bootstrap';
import { setInitialScriptProperties } from './config';
import {
  dropLegacyPartnerSheets,
  dropOrphanStagingFeedback,
  dropOrphanStagingLineRegistration,
  provisionPartnerWorkbooks,
  runCanonicalRefresh,
  runFullRefresh,
  runImportCsvD,
  runPublishAll,
  runPublishCustomerV2,
  runWritebackCollection,
  runWritebackCustomerV2,
} from './main';
import {
  deleteManagedTriggers,
  handleDailyRefreshTrigger,
  handlePublishTrigger,
  handleWritebackTrigger,
  installTriggers,
  reinstallTriggers,
} from './triggers/install';
import {
  menuBootstrapProject,
  menuReinstallTriggers,
  menuRunCanonicalRefresh,
  menuRunFullRefresh,
  menuRunImportCsvD,
  menuRunPublishAll,
  menuRunPublishCustomerV2,
  menuRunWritebackCollection,
  menuRunWritebackCustomerV2,
  menuValidateEnvironment,
  onOpen,
} from './ui/menu';

declare const globalThis: Record<string, unknown> & {
  __potex?: Record<string, Function>;
};

globalThis.__potex = {
  bootstrapProject,
  validateEnvironment,
  setInitialScriptProperties,
  runCanonicalRefresh,
  runFullRefresh,
  runPublishAll,
  runWritebackCollection,
  runImportCsvD,
  runPublishCustomerV2,
  runWritebackCustomerV2,
  provisionPartnerWorkbooks,
  dropLegacyPartnerSheets,
  dropOrphanStagingLineRegistration,
  dropOrphanStagingFeedback,
  installTriggers,
  deleteManagedTriggers,
  reinstallTriggers,
  handlePublishTrigger,
  handleWritebackTrigger,
  handleDailyRefreshTrigger,
  onOpen,
  menuValidateEnvironment,
  menuBootstrapProject,
  menuRunCanonicalRefresh,
  menuRunFullRefresh,
  menuRunPublishAll,
  menuRunWritebackCollection,
  menuRunImportCsvD,
  menuRunPublishCustomerV2,
  menuRunWritebackCustomerV2,
  menuReinstallTriggers,
};
