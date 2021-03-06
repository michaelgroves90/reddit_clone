import { User } from "../entities/User";
import { MyContext } from "../types";
import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Resolver } from "type-graphql";
import argon2 from 'argon2';
import { Query } from "type-graphql";


@InputType()
class UsernamePasswordInput {
  @Field()
  username: string;
  @Field()
  password: string;
}

@ObjectType()
class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;

}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[]
  @Field(() => User, { nullable: true })
  user?: User
}

@Resolver()
export class UserResolver {

  @Query(() => User, { nullable: true })
  async me(
    @Ctx() { req, em }: MyContext) {
    // you are not logged in
    if (!req.session.userId) {
      return null
    }

    const user = await em.findOne(User, { id: req.session.userId });
    return user;
  }
  // User registration
  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { em }: MyContext
  ): Promise<UserResponse> {
    // Username length too small
    if (options.username.length <= 2) {
      return {
        errors: [
          {
          field: "username",
          message: "length must be greater than 2",
          },
        ],
      };
    }
    // Password length too small
    if (options.password.length <= 3) {
      return {
        errors: [
          {
          field: "password",
          message: "length must be greater than 3",
          },
        ],
      };
    }

    const hashedPassword = await argon2.hash(options.password);
    const user = em.create(User, {
      username: options.username,
      password: hashedPassword,
    });
    try {
      await em.persistAndFlush(user);
    } catch(err) {
      // Duplicate username error
      if (err.detail.includes("already exists")) {
        return {
          errors: [
            {
            field: "username",
            message: "username already taken"
            },
          ],
        };
      }
    } 
    return { user };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(User, { username: options.username });
    // Username does not exist
    if (!user) {
      return {
        errors: [
          {
          field: "username",
          message: "that username does not exist"
          },
        ],
      };
    }
    const valid = await argon2.verify(user.password, options.password);
    // Password is incorrect
    if (!valid) {
      return {
        errors: [
          {
            field: "password",
            message: "incorrect password"
          },
        ],
      };
    }

    req.session.userId = user.id;

    return { user };
  }  
}