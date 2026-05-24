import { bootstrapProject, validateEnvironment } from './bootstrap';
import { setInitialScriptProperties } from './config';
import {
  dropLegacyPartnerSheets,
  dropOrphanStagingFeedback,
  dropOrphanStagingLineRegistration,
  provisionPartnerWorkbooks,
  runCanonicalRefresh,
  runFullRefresh,
  runPublishAll,
  runWritebackCollection,
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
  menuRunPublishAll,
  menuRunWritebackCollection,
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
  menuReinstallTriggers,
};
