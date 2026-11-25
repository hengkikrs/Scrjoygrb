import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recoverInterruptedRecords,
  stepWorkflowMachine,
  type MachineContext,
} from './state-machine';
import {
  DEFAULT_WORKFLOW_PROFILE,
  EMPTY_FORM_VALUES,
  INITIAL_MOCK_DEVICES,
} from './mock-device';
import type { PoiRecord } from './types';

function makeRecords(): PoiRecord[] {
  const now = '2026-11-24T00:00:00.000Z';
  return [
    {
      record_id: 'rec_done',
      job_id: 'job_1',
      source_row_number: 1,
      poi_name: 'Already Done POI',
      phone_number: '081111111111',
      website: '',
      opening_hours: 'Mon-Sun 08:00-20:00',
      status: 'SUCCESS',
      notes: 'Already completed',
      attempt_count: 1,
      last_error: null,
      updated_at: now,
    },
    {
      record_id: 'rec_pending',
      job_id: 'job_1',
      source_row_number: 2,
      poi_name: 'Kopi Pagi',
      phone_number: '081234567890',
      website: 'https://kopipagi.example',
      opening_hours: 'Mon-Sun 08:00-22:00',
      status: 'PENDING',
      notes: '',
      attempt_count: 0,
      last_error: null,
      updated_at: now,
    },
  ];
}

function makeBaseContext(): MachineContext {
  return {
    state: 'DEVICE_CHECK',
    activeRecordId: null,
    queueRecordIds: [],
    device: { ...INITIAL_MOCK_DEVICES[0] },
    screen: 'GRAB_HOME',
    formValues: { ...EMPTY_FORM_VALUES },
    scrollCount: 0,
    fieldRetryCount: 0,
    verifications: [],
    automationMode: 'ASSISTED',
    autoSubmitPolicyAcknowledged: false,
    skipExistingSuccess: true,
    operatorApprovedSubmit: false,
    injectedFault: null,
    lowOcrConfidence: false,
  };
}

test('Assisted Mode fills and verifies all fields, skips existing SUCCESS, and stops before submit', () => {
  let records = makeRecords();
  let ctx = makeBaseContext();
  const visited: string[] = [ctx.state];

  for (let i = 0; i < 30; i += 1) {
    const out = stepWorkflowMachine(ctx, records, DEFAULT_WORKFLOW_PROFILE);
    if (out.recordUpdate) {
      records = records.map((r) =>
        r.record_id === out.recordUpdate!.record_id
          ? {
              ...r,
              status: out.recordUpdate!.status,
              notes: out.recordUpdate!.notes ?? r.notes,
              last_error:
                out.recordUpdate!.last_error !== undefined
                  ? out.recordUpdate!.last_error
                  : r.last_error,
            }
          : r
      );
    }
    ctx = {
      ...ctx,
      state: out.nextState,
      screen: out.updatedScreen,
      formValues: out.updatedFormValues,
      activeRecordId: out.activeRecordId,
      scrollCount: out.scrollCount,
      fieldRetryCount: out.fieldRetryCount,
    };
    visited.push(ctx.state);
    if (out.shouldPause) break;
  }

  // Must skip rec_done and process rec_pending
  assert.equal(ctx.activeRecordId, 'rec_pending');
  // Must stop at WAIT_FOR_OPERATOR_CONFIRMATION in Assisted Mode
  assert.equal(ctx.state, 'WAIT_FOR_OPERATOR_CONFIRMATION');
  assert.equal(ctx.formValues.poi_name, 'Kopi Pagi');
  assert.equal(ctx.formValues.phone_number, '081234567890');
  assert.equal(ctx.formValues.opening_hours, 'Mon-Sun 08:00-22:00');
  assert.equal(ctx.scrollCount, 1);

  // Without operator approval it MUST stay paused at WAIT_FOR_OPERATOR_CONFIRMATION
  const blocked = stepWorkflowMachine(ctx, records, DEFAULT_WORKFLOW_PROFILE);
  assert.equal(blocked.nextState, 'WAIT_FOR_OPERATOR_CONFIRMATION');

  // With explicit operator approval it submits, verifies, marks SUCCESS, and saves checkpoint
  ctx = { ...ctx, operatorApprovedSubmit: true };
  for (let i = 0; i < 6; i += 1) {
    const out = stepWorkflowMachine(ctx, records, DEFAULT_WORKFLOW_PROFILE);
    if (out.recordUpdate) {
      records = records.map((r) =>
        r.record_id === out.recordUpdate!.record_id
          ? { ...r, status: out.recordUpdate!.status }
          : r
      );
    }
    ctx = {
      ...ctx,
      state: out.nextState,
      screen: out.updatedScreen,
      formValues: out.updatedFormValues,
      activeRecordId: out.activeRecordId,
    };
    if (ctx.state === 'SAVE_CHECKPOINT') break;
  }

  assert.equal(records.find((r) => r.record_id === 'rec_pending')?.status, 'SUCCESS');
});

test('halts immediately on CAPTCHA/OTP security dialog or unknown screen without guessing coordinates', () => {
  const records = makeRecords();
  const ctxCaptcha: MachineContext = {
    ...makeBaseContext(),
    state: 'FILL_POI_NAME',
    activeRecordId: 'rec_pending',
    screen: 'SECURITY_DIALOG_CAPTCHA',
  };
  const outCaptcha = stepWorkflowMachine(ctxCaptcha, records, DEFAULT_WORKFLOW_PROFILE);
  assert.equal(outCaptcha.nextState, 'PAUSED');
  assert.equal(outCaptcha.shouldPause, true);
  assert.equal(outCaptcha.log.error_code, 'APP_UNEXPECTED_DIALOG');

  const ctxUnknown: MachineContext = {
    ...makeBaseContext(),
    state: 'SCREEN_CHECK',
    screen: 'SCREEN_UNKNOWN',
  };
  const outUnknown = stepWorkflowMachine(ctxUnknown, records, DEFAULT_WORKFLOW_PROFILE);
  assert.equal(outUnknown.nextState, 'PAUSED');
  assert.equal(outUnknown.log.error_code, 'SCREEN_UNKNOWN');
});

test('never retries submit automatically when submit result is uncertain (SUBMIT_UNCONFIRMED -> NEEDS_REVIEW)', () => {
  const records = makeRecords();
  const ctx: MachineContext = {
    ...makeBaseContext(),
    state: 'SUBMIT_IF_APPROVED',
    activeRecordId: 'rec_pending',
    screen: 'SUBMIT_CONFIRMATION',
    operatorApprovedSubmit: true,
    injectedFault: 'SUBMIT_UNCONFIRMED',
  };

  const out1 = stepWorkflowMachine(ctx, records, DEFAULT_WORKFLOW_PROFILE);
  assert.equal(out1.nextState, 'VERIFY_RESULT');
  assert.equal(out1.updatedScreen, 'SUBMIT_UNCERTAIN');

  const out2 = stepWorkflowMachine(
    { ...ctx, state: out1.nextState, screen: out1.updatedScreen, injectedFault: null },
    records,
    DEFAULT_WORKFLOW_PROFILE
  );
  assert.equal(out2.nextState, 'MARK_NEEDS_REVIEW');
  assert.equal(out2.recordUpdate?.status, 'NEEDS_REVIEW');
  assert.equal(out2.recordUpdate?.last_error, 'SUBMIT_UNCONFIRMED');
});

test('crash recovery converts IN_PROGRESS rows to NEEDS_REVIEW without marking SUCCESS', () => {
  const records = makeRecords();
  records[1].status = 'IN_PROGRESS';

  const recovered = recoverInterruptedRecords(records);
  assert.deepEqual(recovered.recoveredIds, ['rec_pending']);
  assert.equal(recovered.records[1].status, 'NEEDS_REVIEW');
  assert.equal(recovered.records[0].status, 'SUCCESS');
});
