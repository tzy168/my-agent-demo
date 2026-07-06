/**
 * 环境变量配置
 *
 * 职责：集中读取与校验 process.env，对外暴露类型安全的配置对象。
 * 约定：业务代码不直接访问 process.env，统一通过本模块获取。
 */
export const env = {
  /** PostgreSQL 连接串，格式: postgresql://user:password@localhost:5432/dbname */
  databaseUrl: process.env.DATABASE_URL ?? "",
} as const;
