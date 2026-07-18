import { describe, expect, it } from 'vitest';
import { AGENT_SYSTEM_PROMPT } from './prompt';

describe('AGENT_SYSTEM_PROMPT', () => {
  it('tartalmazza a grounding-szabályokat és a magyar válasz-kötelezettséget', () => {
    expect(AGENT_SYSTEM_PROMPT).toContain('<grounding>');
    expect(AGENT_SYSTEM_PROMPT).toContain('searchRules');
    expect(AGENT_SYSTEM_PROMPT).toMatch(/kizárólag/i);
    expect(AGENT_SYSTEM_PROMPT).toContain('nincs információm');
    expect(AGENT_SYSTEM_PROMPT).toMatch(/forrás/i);
    expect(AGENT_SYSTEM_PROMPT).toMatch(/magyar/i);
  });
});
