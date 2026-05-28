import { bootstrapProject, validateEnvironment } from '../bootstrap';
import {
  runCanonicalRefresh,
  runFullRefresh,
  runImportCsvD,
  runPublishAll,
  runPublishCustomerV2,
  runWritebackCollection,
  runWritebackCustomerV2,
} from '../main';
import { reinstallTriggers } from '../triggers/install';

export function onOpen(): void {
  SpreadsheetApp.getUi()
    .createMenu('Potex Sync')
    .addItem('환경 검증', 'menuValidateEnvironment')
    .addItem('초기화', 'menuBootstrapProject')
    .addSeparator()
    .addItem('정본/스테이징 새로고침', 'menuRunCanonicalRefresh')
    .addItem('전체 새로고침', 'menuRunFullRefresh')
    .addItem('운영뷰 게시', 'menuRunPublishAll')
    .addItem('Writeback 수집', 'menuRunWritebackCollection')
    .addSeparator()
    .addSubMenu(
      SpreadsheetApp.getUi()
        .createMenu('顧客DB (v2)')
        .addItem('csvD取込', 'menuRunImportCsvD')
        .addItem('v2書戻し（準備中）', 'menuRunWritebackCustomerV2')
        .addItem('v2公開', 'menuRunPublishCustomerV2'),
    )
    .addSeparator()
    .addItem('트리거 재설치', 'menuReinstallTriggers')
    .addToUi();
}

export function menuValidateEnvironment(): void { validateEnvironment(); }
export function menuBootstrapProject(): void { bootstrapProject(); }
export function menuRunCanonicalRefresh(): void { runCanonicalRefresh(); }
export function menuRunFullRefresh(): void { runFullRefresh(); }
export function menuRunPublishAll(): void { runPublishAll(); }
export function menuRunWritebackCollection(): void { runWritebackCollection(); }
export function menuRunImportCsvD(): void { runImportCsvD(); }
export function menuRunWritebackCustomerV2(): void { runWritebackCustomerV2(); }
export function menuRunPublishCustomerV2(): void { runPublishCustomerV2(); }
export function menuReinstallTriggers(): void { reinstallTriggers(); }
