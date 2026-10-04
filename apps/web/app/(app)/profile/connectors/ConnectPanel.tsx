'use client';

import { useState } from 'react';
import type { ClientTab } from '../../../../src/features/connectors/connectorsView';
import { CopyField } from '../../../../src/ui/CopyField';
import { Segmented } from '../../../../src/ui/Segmented';
import styles from './connectors.module.css';

interface Props {
  endpoint: string;
  /** `claude mcp add --transport http saldo {endpoint}`, built on the server. */
  claudeCode: string;
  /** `npx mcp-remote {endpoint}`. */
  mcpRemote: string;
  /** `{PUBLIC_URL}/.well-known/oauth-protected-resource`. */
  discoveryUrl: string;
  strings: {
    body: string;
    copy: string;
    copied: string;
    clients: string;
    tabClaudeCode: string;
    tabClaude: string;
    tabOther: string;
    claudeCodeHint: string;
    claudeStep1: string;
    claudeStep2: string;
    otherBody: string;
    otherTerminal: string;
  };
}

/**
 * «Collega» (§17.4.3, variant C's top): the explanation, the endpoint with «Copia», and one tab per
 * kind of client with exactly what to type or click there.
 */
export function ConnectPanel({ endpoint, claudeCode, mcpRemote, discoveryUrl, strings }: Props) {
  const [tab, setTab] = useState<ClientTab>('claudeCode');
  const copy = { copyLabel: strings.copy, copiedLabel: strings.copied };
  return (
    <>
      <p className={styles.body}>{strings.body}</p>
      <CopyField value={endpoint} {...copy} />
      <Segmented
        label={strings.clients}
        value={tab}
        options={[
          { value: 'claudeCode', label: strings.tabClaudeCode },
          { value: 'claude', label: strings.tabClaude },
          { value: 'other', label: strings.tabOther },
        ]}
        onChange={setTab}
      />
      {tab === 'claudeCode' ? (
        <>
          <CopyField value={claudeCode} {...copy} />
          <p className={styles.hint}>{strings.claudeCodeHint}</p>
        </>
      ) : null}
      {tab === 'claude' ? (
        <ol className={styles.steps}>
          <li>{strings.claudeStep1}</li>
          <li>{strings.claudeStep2}</li>
        </ol>
      ) : null}
      {tab === 'other' ? (
        <>
          <p className={styles.hint}>{strings.otherBody}</p>
          <code className={styles.path}>{discoveryUrl}</code>
          <p className={styles.hint}>{strings.otherTerminal}</p>
          <CopyField value={mcpRemote} {...copy} />
        </>
      ) : null}
    </>
  );
}
