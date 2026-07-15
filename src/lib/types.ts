export interface MissingSkill {
    skill: string;
    detail: string;
}

export interface ImprovementPlan {
    title: string;
    detail: string;
}

export interface JDTruth {
    phrase: string;
    meaning: string;
}

export interface AnalysisResult {
    score: number;
    job_title: string;
    company_name: string;
    company_info?: string;
    jd_text?: string; // 原始招聘信息文本
    overall_review: string;
    owned_skills: string[];
    missing_skills: MissingSkill[];
    improvement_plan: ImprovementPlan[];
    jd_truth: JDTruth[];
}
