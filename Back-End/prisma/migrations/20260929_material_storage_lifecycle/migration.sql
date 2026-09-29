ALTER TABLE "CourseMaterial" ALTER COLUMN "fileUrl" DROP NOT NULL;
ALTER TABLE "CourseMaterial" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "CourseMaterial" ADD COLUMN "fileSizeBytes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CourseMaterial" ADD COLUMN "processingStatus" TEXT NOT NULL DEFAULT 'UPLOADED';

CREATE INDEX "CourseMaterial_courseId_createdAt_idx" ON "CourseMaterial"("courseId", "createdAt");
