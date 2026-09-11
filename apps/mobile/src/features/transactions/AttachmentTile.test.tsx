import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import type { LocalAttachment } from '../../db/repositories';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { AttachmentTile } from './AttachmentTile';

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

function attachment(overrides: Partial<LocalAttachment> = {}): LocalAttachment {
  return {
    id: 'att-1',
    createdAt: '2026-09-11T10:00:00.000Z',
    updatedAt: '001775000000000-0000-dev',
    deletedAt: null,
    transactionId: 'tx-1',
    mimeType: 'image/jpeg',
    byteSize: 1024,
    sha256: 'a'.repeat(64),
    width: 800,
    height: 600,
    localUri: 'file:///attachments/att-1.jpg',
    blobState: 'local_only',
    ...overrides,
  };
}

async function show(row: LocalAttachment, labelled = true) {
  const onPress = jest.fn();
  await render(
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>
        <AttachmentTile row={row} width={96} height={124} labelled={labelled} onPress={onPress} />
      </I18nextProvider>
    </ThemeProvider>,
  );
  return onPress;
}

describe('AttachmentTile', () => {
  it('opens the viewer when tapped', async () => {
    const onPress = await show(attachment());
    await userEvent.press(screen.getByLabelText('Open attachment'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('says a PDF is a PDF rather than showing a blank image', async () => {
    await show(attachment({ mimeType: 'application/pdf' }));
    expect(screen.getByText('PDF document')).toBeTruthy();
  });

  it('says so when the bytes are on another device', async () => {
    await show(attachment({ localUri: null, blobState: 'synced' }));
    expect(screen.getByText('Not available on this phone')).toBeTruthy();
  });

  it('drops the caption on the small tile, which has no room for it', async () => {
    await show(attachment({ mimeType: 'application/pdf' }), false);
    expect(screen.queryByText('PDF document')).toBeNull();
    expect(screen.getByLabelText('Open attachment')).toBeTruthy();
  });
});
