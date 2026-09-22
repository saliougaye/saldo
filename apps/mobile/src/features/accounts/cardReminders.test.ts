import {
  isReminderId,
  reminderAccountId,
  reminderId,
  reminderPayload,
  reminderTrigger,
} from './cardReminders';

describe('card reminders', () => {
  it('names one request per card', () => {
    expect(reminderId('acc-1')).toBe('card-charge:acc-1');
    expect(isReminderId('card-charge:acc-1')).toBe(true);
    expect(isReminderId('budget-1')).toBe(false);
  });

  it('fires at the given hour, local time, on the charge day', () => {
    expect(reminderTrigger('2026-05-05', 9, new Date(2026, 4, 1, 12))).toEqual(
      new Date(2026, 4, 5, 9, 0, 0, 0),
    );
    expect(reminderTrigger('2026-05-05', 9, new Date(2026, 4, 5, 8, 59))).toEqual(
      new Date(2026, 4, 5, 9, 0, 0, 0),
    );
  });

  it('is not scheduled once that moment has passed', () => {
    expect(reminderTrigger('2026-05-05', 9, new Date(2026, 4, 5, 9, 0))).toBeNull();
    expect(reminderTrigger('2026-05-05', 9, new Date(2026, 4, 6, 7, 0))).toBeNull();
  });

  it('reads the card back from a tapped notification, and nothing else', () => {
    expect(reminderAccountId(reminderPayload('acc-1'))).toBe('acc-1');
    expect(reminderAccountId({ kind: 'other', accountId: 'acc-1' })).toBeNull();
    expect(reminderAccountId({ kind: 'cardCharge', accountId: 3 })).toBeNull();
    expect(reminderAccountId(undefined)).toBeNull();
    expect(reminderAccountId(null)).toBeNull();
  });
});
