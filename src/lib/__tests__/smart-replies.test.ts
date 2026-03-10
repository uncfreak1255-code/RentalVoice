import { generateSmartReplies } from '../smart-replies';

describe('generateSmartReplies', () => {
  it('keeps only the welcome reply for thanks messages', () => {
    const replies = generateSmartReplies('Thanks so much for the help!');
    expect(replies.map((reply) => reply.label)).toEqual(["You're welcome"]);
  });

  it('does not suggest review requests for check-out messages', () => {
    const replies = generateSmartReplies('We are all set for checkout tomorrow morning.');
    expect(replies.some((reply) => /review/i.test(reply.label) || /review/i.test(reply.content))).toBe(false);
  });
});
