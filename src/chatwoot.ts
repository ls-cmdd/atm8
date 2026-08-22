import axios from 'axios';

export class ChatwootClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(baseUrl?: string, accessToken?: string) {
    this.baseUrl = baseUrl || process.env.CHATWOOT_BASE_URL || 'http://localhost:3000';
    this.accessToken = accessToken || process.env.CHATWOOT_ACCESS_TOKEN || '';
  }

  private get headers() {
    return {
      'api_access_token': this.accessToken,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Send a reply to a conversation
   */
  async sendReply(accountId: number, conversationId: number, content: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
        { content, message_type: 'outgoing' },
        { headers: this.headers }
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('Chatwoot sendReply Error:', error.response?.data || error.message);
      throw new Error(`Failed to send reply to Chatwoot: ${error.message}`);
    }
  }

  /**
   * Fetch conversation details
   */
  async getConversation(accountId: number, conversationId: number) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}`,
        { headers: this.headers }
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('Chatwoot getConversation Error:', error.response?.data || error.message);
      throw new Error(`Failed to get conversation from Chatwoot: ${error.message}`);
    }
  }

  /**
   * Update conversation status (e.g., open, resolved, pending)
   */
  async updateConversationStatus(accountId: number, conversationId: number, status: 'open' | 'resolved' | 'pending' | 'snoozed') {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/toggle_status`,
        { status },
        { headers: this.headers }
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('Chatwoot updateConversationStatus Error:', error.response?.data || error.message);
      throw new Error(`Failed to update conversation status in Chatwoot: ${error.message}`);
    }
  }
}
