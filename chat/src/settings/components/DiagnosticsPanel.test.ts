import { fireEvent, render, screen } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@/i18n';
import DiagnosticsPanel from './DiagnosticsPanel.vue';

describe('DiagnosticsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.setLocale('en');
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText: vi.fn(async () => undefined) },
      configurable: true,
    });
  });

  it('shows only the safe summary by default', () => {
    render(DiagnosticsPanel, {
      props: {
        safeDiagnostics: 'safe output',
        detailedDiagnostics: 'detail output',
        detailConfirmed: false,
      },
    });

    expect(screen.getByRole('heading', { name: 'Diagnostics' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Safe summary' })).toBeInTheDocument();
    expect(screen.getByText('safe output')).toBeInTheDocument();
    expect(screen.queryByText('detail output')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show development details' })).toBeInTheDocument();
  });

  it('asks for confirmation before emitting the detail confirmation event', async () => {
    const { emitted } = render(DiagnosticsPanel, {
      props: {
        safeDiagnostics: 'safe output',
        detailedDiagnostics: 'detail output',
        detailConfirmed: false,
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Show development details' }));
    expect(emitted()['confirm-detail']).toBeUndefined();
    expect(
      screen.getByText(
        'Development details may include user and room identifiers. They do not include message text or tokens.',
      ),
    ).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
    expect(emitted()['confirm-detail']).toHaveLength(1);
  });

  it('shows and copies detailed diagnostics after confirmation', async () => {
    render(DiagnosticsPanel, {
      props: {
        safeDiagnostics: 'safe output',
        detailedDiagnostics: 'detail output',
        detailConfirmed: true,
      },
    });

    expect(screen.getByRole('heading', { name: 'Development details' })).toBeInTheDocument();
    expect(screen.getByText('detail output')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Copy safe summary' }));
    expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith('safe output');

    await fireEvent.click(screen.getByRole('button', { name: 'Copy development details' }));
    expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith('detail output');
  });

  it('ignores clipboard write failures when diagnostics remain visible', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('clipboard blocked');
    });

    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(DiagnosticsPanel, {
      props: {
        safeDiagnostics: 'safe output',
        detailedDiagnostics: 'detail output',
        detailConfirmed: true,
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Copy safe summary' }));
    expect(writeText).toHaveBeenCalledWith('safe output');
  });
});
