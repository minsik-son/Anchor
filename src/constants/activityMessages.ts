/**
 * Activity Message System
 * Decoupled message definitions with i18n keys and condition functions
 */

export type MessageCategory = 'eco' | 'carbon' | 'goal' | 'landmark' | 'comparison';

export interface MessageContext {
    todaySteps: number;
    todayDistance: number;     // meters
    todayCalories: number;
    yesterdaySteps: number;
    totalDistanceKm: number;
}

export interface ActivityMessage {
    id: string;
    category: MessageCategory;
    i18nKey: string;
    condition: (ctx: MessageContext) => boolean;
    variables: (ctx: MessageContext) => Record<string, string | number>;
    icon: string;
}

const MESSAGES: ActivityMessage[] = [
    {
        id: 'eco_trees',
        category: 'eco',
        i18nKey: 'activity.messages.ecoTrees',
        condition: (ctx) => ctx.todayDistance >= 500,
        variables: (ctx) => ({
            trees: Math.round((ctx.todayDistance / 1000) * 0.22 * 100) / 100,
        }),
        icon: '\uD83C\uDF33',
    },
    {
        id: 'carbon_reduction',
        category: 'carbon',
        i18nKey: 'activity.messages.carbonReduction',
        condition: (ctx) => ctx.todaySteps >= 1000,
        variables: (ctx) => ({
            grams: Math.round(ctx.todayDistance / 1000 * 210),
        }),
        icon: '\uD83C\uDF0D',
    },
    {
        id: 'goal_motivation',
        category: 'goal',
        i18nKey: 'activity.messages.goalMotivation',
        condition: (ctx) => ctx.todaySteps >= 5000 && ctx.todaySteps < 10000,
        variables: (ctx) => ({
            remaining: 10000 - ctx.todaySteps,
        }),
        icon: '\uD83D\uDCAA',
    },
    {
        id: 'landmark_burj',
        category: 'landmark',
        i18nKey: 'activity.messages.landmarkBurj',
        condition: (ctx) => ctx.totalDistanceKm >= 0.828,
        variables: (ctx) => ({
            height: 828,
        }),
        icon: '\uD83C\uDFD7\uFE0F',
    },
    {
        id: 'comparison_yesterday',
        category: 'comparison',
        i18nKey: 'activity.messages.comparisonYesterday',
        condition: (ctx) => ctx.yesterdaySteps > 0 && ctx.todaySteps > ctx.yesterdaySteps,
        variables: (ctx) => ({
            percent: Math.round(((ctx.todaySteps - ctx.yesterdaySteps) / ctx.yesterdaySteps) * 100),
        }),
        icon: '\uD83D\uDD25',
    },
];

export function getActiveMessages(context: MessageContext): ActivityMessage[] {
    return MESSAGES.filter((msg) => msg.condition(context));
}
