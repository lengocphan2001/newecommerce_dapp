export declare enum UserStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    SUSPENDED = "SUSPENDED",
    BANNED = "BANNED"
}
export declare class UpdateUserStatusDto {
    status: UserStatus;
}
