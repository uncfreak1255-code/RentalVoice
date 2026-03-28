import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendHostawayMessageViaServer } from '@/lib/api-client';
import { sendMessage as sendHostawayMessage } from '@/lib/hostaway';
import {
  UNDO_DELAY_MS,
  checkAndSendScheduledMessages,
  getPendingMessages,
} from '../automation-engine';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

jest.mock('@/lib/hostaway', () => ({
  sendMessage: jest.fn(),
}));

jest.mock('@/lib/api-client', () => ({
  sendHostawayMessageViaServer: jest.fn(),
}));

jest.mock('@/lib/config', () => ({
  features: {
    serverProxiedAI: true,
  },
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockedSendHostawayMessage = sendHostawayMessage as jest.MockedFunction<typeof sendHostawayMessage>;
const mockedSendHostawayMessageViaServer = sendHostawayMessageViaServer as jest.MockedFunction<typeof sendHostawayMessageViaServer>;

describe('automation-engine managed send path', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockedAsyncStorage.getItem.mockResolvedValue(null);
    mockedAsyncStorage.setItem.mockResolvedValue();
    mockedSendHostawayMessage.mockResolvedValue({
      id: 1,
      conversationId: 42,
      body: 'sent',
      isIncoming: false,
      status: 'sent',
      insertedOn: new Date().toISOString(),
    });
    mockedSendHostawayMessageViaServer.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('sends scheduled messages through the server in managed mode', async () => {
    const now = new Date('2026-03-28T10:00:00.000Z');
    jest.setSystemTime(now);

    const results = await checkAndSendScheduledMessages({
      accountId: '',
      apiKey: '',
      hostName: 'Sawyer',
      propertyKnowledge: {},
      properties: [
        {
          id: 'prop-1',
          name: 'Beach House',
        } as any,
      ],
      scheduledMessages: [
        {
          id: 'sched-1',
          propertyId: 'prop-1',
          name: 'Check-in reminder',
          template: 'Hi {{guest_name}}, welcome to {{property_name}}',
          triggerType: 'before_checkin',
          triggerHours: 0,
          isActive: true,
        } as any,
      ],
      conversations: [
        {
          id: '42',
          status: 'active',
          checkInDate: now,
          property: { id: 'prop-1', name: 'Beach House' },
          guest: { name: 'Taylor' },
        } as any,
      ],
    });

    expect(results).toHaveLength(1);
    expect(getPendingMessages()).toHaveLength(1);

    jest.advanceTimersByTime(UNDO_DELAY_MS);
    await Promise.resolve();

    expect(mockedSendHostawayMessageViaServer).toHaveBeenCalledWith(
      42,
      'Hi Taylor, welcome to Beach House'
    );
    expect(mockedSendHostawayMessage).not.toHaveBeenCalled();
  });
});
