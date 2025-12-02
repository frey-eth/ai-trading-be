/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger } from '@nestjs/common';
import { HumanMessage } from 'langchain';

export enum AgentName {
  GEMINI_PRO = 'gemini-2.5-pro',
}

export interface IAgentConfig {
  provider: string;
  apiKey: string;
  name: AgentName;
}

@Injectable()
export class AgentService {
  private agents: Map<string, ChatGoogleGenerativeAI | any> = new Map();
  private readonly logger = new Logger(AgentService.name);
  constructor() {
    this.initializeAgents();
  }

  private initializeAgents() {
    const geminiKey = process.env.GOOGLE_API_KEY;
    if (geminiKey) {
      this.agents.set(
        AgentName.GEMINI_PRO,
        new ChatGoogleGenerativeAI({
          model: AgentName.GEMINI_PRO,
          apiKey: geminiKey,
          maxOutputTokens: 2048,
          temperature: 0.7,
        }),
      );
      this.logger.log('✅ Google Gemini agents initialized successfully');
    }
  }

  getAgent(
    name: AgentName = AgentName.GEMINI_PRO,
  ): ChatGoogleGenerativeAI | unknown {
    return this.agents.get(name);
  }

  async callAgent(
    promptTemplate: string,
    variables: Record<string, unknown>,
    agentName: AgentName = AgentName.GEMINI_PRO,
  ): Promise<string> {
    const agent = this.getAgent(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }
    let prompt = promptTemplate;
    for (const [key, value] of Object.entries(variables)) {
      let stringValue = '';
      if (value === null || value === undefined) {
        stringValue = '';
      } else if (typeof value === 'string') {
        stringValue = value;
      } else if (typeof value === 'object') {
        stringValue = JSON.stringify(value);
      } else if (
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        typeof value === 'bigint' ||
        typeof value === 'symbol'
      ) {
        stringValue = String(value);
      } else {
        stringValue = '';
      }
      prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), stringValue);
    }
    const message = new HumanMessage(prompt);
    const response = await (agent as any)._generate([message], {
      maxTokens: 2048,
      temperature: 0.7,
    });
    let content: string;

    // Handle _generate response format: { generations: [{ text: "..." }] }
    if (response?.generations && Array.isArray(response.generations)) {
      const firstGeneration = response.generations[0];
      if (firstGeneration?.text) {
        content = firstGeneration.text;
      } else if (firstGeneration?.message?.content) {
        content =
          typeof firstGeneration.message.content === 'string'
            ? firstGeneration.message.content
            : JSON.stringify(firstGeneration.message.content);
      } else {
        content = JSON.stringify(firstGeneration);
      }
    } else if (typeof response === 'string') {
      content = response;
    } else if (response?.content) {
      content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);
    } else if (response?.text) {
      content = response.text;
    } else {
      content = JSON.stringify(response);
    }

    this.logger.debug(`${agentName} response: ${content.substring(0, 150)}...`);
    return content;
  }
}
