import { UserRole } from "@common/enums/user.enums";

export interface IChangeRoleBody {
  role: UserRole;
}

export interface IUpdateUserBody {
  updates: {
    phoneNumber?: string;
    profilePicture?: string;
  };
}

export interface IForgotPasswordBody {
  email: string;
}

export interface IUserIdParams {
  id: string;
}
