-- AlterTable: add optional bio field to users for profile editing
ALTER TABLE "users" ADD COLUMN "bio" TEXT;

-- CreateTable: implicit many-to-many between Issue and User for mentions in descriptions
CREATE TABLE "_IssueMentions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "_IssueMentions_AB_unique" ON "_IssueMentions"("A", "B");

-- CreateIndex
CREATE INDEX "_IssueMentions_B_index" ON "_IssueMentions"("B");

-- AddForeignKey
ALTER TABLE "_IssueMentions" ADD CONSTRAINT "_IssueMentions_A_fkey" FOREIGN KEY ("A") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IssueMentions" ADD CONSTRAINT "_IssueMentions_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
