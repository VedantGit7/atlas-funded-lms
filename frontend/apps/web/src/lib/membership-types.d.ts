export type MemberRow = {
    id: string;
    status: string;
    invitedEmail?: string | null;
    profile: {
        id: string;
        displayName: string | null;
        avatarUrl: string | null;
    } | null;
};
export type MembersListResponse = {
    data: {
        items: MemberRow[];
        pageInfo: {
            hasNextPage: boolean;
        };
    };
};
export type MemberDetailResponse = {
    data: {
        id: string;
        status: string;
        invitedEmail?: string | null;
        profile: {
            id: string;
            displayName: string | null;
            avatarUrl: string | null;
            bio?: string | null;
        } | null;
        roles: Array<{
            id: string;
            key: string;
            name: string;
            isSystem: boolean;
        }>;
    };
};
