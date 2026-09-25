import { render, screen, userEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ConfirmDialog } from './ConfirmDialog';

async function renderDialog(extra: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const props = {
    visible: true,
    title: 'Data on this phone',
    confirmLabel: 'Bring into the account',
    cancelLabel: 'Cancel',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    ...extra,
  };
  await render(
    <ThemeProvider preference="dark">
      <ConfirmDialog {...props} />
    </ThemeProvider>,
  );
  return props;
}

describe('ConfirmDialog', () => {
  it('offers two answers by default', async () => {
    await renderDialog();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('offers a third answer between the two when asked to', async () => {
    const onAlternative = jest.fn();
    await renderDialog({ alternativeLabel: 'Delete and use the server', onAlternative });
    expect(screen.getAllByRole('button')).toHaveLength(3);
    await userEvent.press(screen.getByText('Delete and use the server'));
    expect(onAlternative).toHaveBeenCalledTimes(1);
  });
});
