import type { Conversation, Issue } from '@/lib/store';

export type DailyBriefingActionKind = 'issue' | 'check_in' | 'check_out';

export interface DailyBriefingAction {
  id: string;
  kind: DailyBriefingActionKind;
  conversationId: string;
  label: string;
  meta: string;
}

export interface DailyBriefingViewModel {
  title: string;
  summary: string;
  actions: DailyBriefingAction[];
  counts: {
    unresolvedIssues: number;
    arrivals: number;
    departures: number;
  };
}

interface BuildDailyBriefingArgs {
  conversations: Conversation[];
  issues: Issue[];
  now?: Date;
}

const ISSUE_PRIORITY_RANK: Record<Issue['priority'], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function isWithinNext48Hours(date: Date, now: Date): boolean {
  const soon = new Date(now);
  soon.setHours(soon.getHours() + 48);
  return date >= now && date <= soon;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatIssueCategory(category: Issue['category']): string {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatStayMeta(prefix: string, date: Date): string {
  return `${prefix} ${date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })}`;
}

export function buildDailyBriefing({
  conversations,
  issues,
  now = new Date(),
}: BuildDailyBriefingArgs): DailyBriefingViewModel | null {
  const activeConversations = conversations.filter(
    (conversation) =>
      conversation.status !== 'archived' && conversation.workflowStatus !== 'archived'
  );

  const conversationMap = new Map(activeConversations.map((conversation) => [conversation.id, conversation]));

  const unresolvedIssues = issues
    .filter((issue) => issue.status !== 'resolved' && conversationMap.has(issue.conversationId))
    .sort((a, b) => {
      const priorityDelta = ISSUE_PRIORITY_RANK[a.priority] - ISSUE_PRIORITY_RANK[b.priority];
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const arrivals = activeConversations
    .filter((conversation) => {
      if (!conversation.checkInDate) return false;
      return isWithinNext48Hours(new Date(conversation.checkInDate), now);
    })
    .sort(
      (a, b) =>
        new Date(a.checkInDate as Date).getTime() - new Date(b.checkInDate as Date).getTime()
    );

  const departures = activeConversations
    .filter((conversation) => {
      if (!conversation.checkOutDate) return false;
      return isWithinNext48Hours(new Date(conversation.checkOutDate), now);
    })
    .sort(
      (a, b) =>
        new Date(a.checkOutDate as Date).getTime() - new Date(b.checkOutDate as Date).getTime()
    );

  if (unresolvedIssues.length === 0 && arrivals.length === 0 && departures.length === 0) {
    return null;
  }

  const actions: DailyBriefingAction[] = [];

  unresolvedIssues.forEach((issue) => {
    const conversation = conversationMap.get(issue.conversationId);
    if (!conversation) return;

    actions.push({
      id: `issue-${issue.id}`,
      kind: 'issue',
      conversationId: issue.conversationId,
      label: `Follow up with ${conversation.guest.name}`,
      meta: `${formatIssueCategory(issue.category)} issue · ${conversation.property.name}`,
    });
  });

  arrivals.forEach((conversation) => {
    actions.push({
      id: `arrival-${conversation.id}`,
      kind: 'check_in',
      conversationId: conversation.id,
      label: `Confirm arrival details for ${conversation.guest.name}`,
      meta: `${formatStayMeta('Check-in', new Date(conversation.checkInDate as Date))} · ${conversation.property.name}`,
    });
  });

  departures.forEach((conversation) => {
    actions.push({
      id: `departure-${conversation.id}`,
      kind: 'check_out',
      conversationId: conversation.id,
      label: `Prepare departure details for ${conversation.guest.name}`,
      meta: `${formatStayMeta('Check-out', new Date(conversation.checkOutDate as Date))} · ${conversation.property.name}`,
    });
  });

  const summaryParts: string[] = [];
  if (unresolvedIssues.length > 0) {
    summaryParts.push(pluralize(unresolvedIssues.length, 'unresolved issue'));
  }
  if (arrivals.length > 0) {
    summaryParts.push(pluralize(arrivals.length, 'arrival'));
  }
  if (departures.length > 0) {
    summaryParts.push(pluralize(departures.length, 'departure'));
  }

  return {
    title: "Today's briefing",
    summary: summaryParts.join(' · '),
    actions: actions.slice(0, 3),
    counts: {
      unresolvedIssues: unresolvedIssues.length,
      arrivals: arrivals.length,
      departures: departures.length,
    },
  };
}
