export interface SlackMessage {
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  text: string;
  ts: string;
  thread_id?: string;
  permalink: string;
  created_at: string;
  mention_type: string | null; // 'user', 'group', or null
  [key: string]: unknown;
}

export interface User {
  user_id: string;
  user_name: string;
  nickname: string;
  [key: string]: unknown;
}

export interface Group {
  group_id: string;
  group_name: string;
  handle: string;
  [key: string]: unknown;
}

export interface Mention {
  channel_id: string;
  message_ts: string;
  user_id: string;
  [key: string]: unknown;
}
