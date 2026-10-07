CREATE TABLE "CourseLearningTopic" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 60,
    "source" TEXT NOT NULL DEFAULT 'AI',
    "materialCovered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourseLearningTopic_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StudyTask" ADD COLUMN "learningTopicId" TEXT;
ALTER TABLE "StudyTask" ADD COLUMN "isDailyStudy" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "CourseLearningTopic_courseId_sequence_key" ON "CourseLearningTopic"("courseId", "sequence");
CREATE INDEX "StudyTask_learningTopicId_idx" ON "StudyTask"("learningTopicId");

ALTER TABLE "CourseLearningTopic" ADD CONSTRAINT "CourseLearningTopic_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudyTask" ADD CONSTRAINT "StudyTask_learningTopicId_fkey" FOREIGN KEY ("learningTopicId") REFERENCES "CourseLearningTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
