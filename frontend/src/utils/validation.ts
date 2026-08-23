/**
 * 场景表单用校验工具
 */

import type { ScenarioFormData } from "../types";

export const validateBasicInfo = (
  title: string,
  description: string,
  category: string,
  language: string,
  scenarioId?: string,
  maxTurns?: number,
) => {
  const errors = {
    scenarioId: null as string | null,
    title: null as string | null,
    description: null as string | null,
    category: null as string | null,
    language: null as string | null,
    maxTurns: null as string | null,
  };

  // 场景 ID 的校验（可选字段）
  if (scenarioId && scenarioId.trim()) {
    const scenarioIdPattern = /^[a-zA-Z0-9-]+$/;
    if (!scenarioIdPattern.test(scenarioId.trim())) {
      errors.scenarioId = "scenarios.validation.scenarioIdInvalid";
    } else if (scenarioId.trim().length > 50) {
      errors.scenarioId = "scenarios.validation.scenarioIdTooLong";
    }
  }

  // 标题的校验
  if (!title.trim()) {
    errors.title = "scenarios.validation.titleRequired";
  } else if (title.trim().length < 3) {
    errors.title = "scenarios.validation.titleTooShort";
  } else if (title.trim().length > 100) {
    errors.title = "scenarios.validation.titleTooLong";
  }

  // 说明的校验
  if (!description.trim()) {
    errors.description = "scenarios.validation.descriptionRequired";
  } else if (description.trim().length < 10) {
    errors.description = "scenarios.validation.descriptionTooShort";
  } else if (description.trim().length > 1000) {
    errors.description = "scenarios.validation.descriptionTooLong";
  }

  // 分类的校验
  if (!category.trim()) {
    errors.category = "scenarios.validation.categoryRequired";
  }

  // 语言的校验
  if (!language.trim()) {
    errors.language = "scenarios.validation.languageRequired";
  }

  // 最大轮数的校验（可选字段，需在 1-100 范围内）
  if (maxTurns !== undefined) {
    if (maxTurns <= 0) {
      errors.maxTurns = "scenarios.validation.maxTurnsPositive";
    } else if (maxTurns > 100) {
      errors.maxTurns = "scenarios.validation.maxTurnsTooLarge";
    }
  }

  return errors;
};

export const validateNpcInfo = (
  name: string,
  role: string,
  company: string,
) => {
  const errors = {
    name: null as string | null,
    role: null as string | null,
    company: null as string | null,
  };

  // 姓名的校验
  if (!name.trim()) {
    errors.name = "scenarios.validation.npcNameRequired";
  } else if (name.trim().length < 2) {
    errors.name = "scenarios.validation.npcNameTooShort";
  } else if (name.trim().length > 50) {
    errors.name = "scenarios.validation.npcNameTooLong";
  }

  // 职务的校验
  if (!role.trim()) {
    errors.role = "scenarios.validation.npcRoleRequired";
  } else if (role.trim().length > 100) {
    errors.role = "scenarios.validation.npcRoleTooLong";
  }

  // 公司名的校验
  if (!company.trim()) {
    errors.company = "scenarios.validation.npcCompanyRequired";
  } else if (company.trim().length > 100) {
    errors.company = "scenarios.validation.npcCompanyTooLong";
  }

  return errors;
};

export const validateGoals = (
  objectives: string[], // 为兼容保留但不使用
  goals: Array<{
    id: string;
    description: string;
    isRequired: boolean;
    priority: number;
    criteria: string[];
  }>,
) => {
  const errors = {
    goals: null as string | null,
  };

  // 目标的校验
  if (goals.length === 0) {
    errors.goals = "scenarios.validation.goalsRequired";
  } else {
    // 检查每个目标是否设置了条件
    const invalidGoals = goals.filter((goal) => goal.criteria.length === 0);
    if (invalidGoals.length > 0) {
      errors.goals = "scenarios.validation.goalsCriteriaRequired";
    }
  }

  return errors;
};

export const validateSharing = (
  visibility: "public" | "private" | "shared",
  sharedWithUsers: string[],
  guardrail: string,
) => {
  const errors = {
    sharedWithUsers: null as string | null,
    guardrail: null as string | null,
  };

  // 共享设置的校验
  if (visibility === "shared" && sharedWithUsers.length === 0) {
    errors.sharedWithUsers = "scenarios.validation.sharedUsersRequired";
  }

  // Guardrail 的校验
  if (!guardrail.trim()) {
    errors.guardrail = "scenarios.validation.guardrailRequired";
  }

  return errors;
};

export const validateForm = (formData: ScenarioFormData) => {
  const basicInfoValidation = validateBasicInfo(
    formData.title,
    formData.description,
    formData.category,
    formData.language,
    formData.scenarioId,
  );

  const npcInfoValidation = validateNpcInfo(
    formData.npc.name,
    formData.npc.role,
    formData.npc.company,
  );

  const goalsValidation = validateGoals([], formData.goals);

  const sharingValidation = validateSharing(
    formData.visibility,
    formData.sharedWithUsers,
    formData.guardrail,
  );

  // 检查所有错误是否为 null
  const isBasicInfoValid = Object.values(basicInfoValidation).every(
    (error) => error === null,
  );
  const isNpcInfoValid = Object.values(npcInfoValidation).every(
    (error) => error === null,
  );
  const isGoalsValid = Object.values(goalsValidation).every(
    (error) => error === null,
  );
  const isSharingValid = Object.values(sharingValidation).every(
    (error) => error === null,
  );

  return {
    basicInfo: basicInfoValidation,
    npcInfo: npcInfoValidation,
    goals: goalsValidation,
    sharing: sharingValidation,
    isValid:
      isBasicInfoValid && isNpcInfoValid && isGoalsValid && isSharingValid,
  };
};
