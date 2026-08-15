import { Response } from 'express';
import { Course } from '@prisma/client';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import prisma from '../../config/db';

export const onboardUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized user.' });
    }

    const { major, semesterName, dailyGoalHours, aiMode, courses } = req.body;

    if (!major || !semesterName) {
      return res.status(400).json({ error: 'Major and semester name are required.' });
    }

    // Single Database Transaction for Atomic Data Saving
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update User Profile
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          major,
          semester: semesterName,
          dailyGoalHours: dailyGoalHours ? Number(dailyGoalHours) : 3,
          aiMode: aiMode || 'balanced',
          isOnboarded: true,
        },
      });

      // 2. Create Active Semester
      const newSemester = await tx.semester.create({
        data: {
          userId,
          name: semesterName,
          isCurrent: true,
        },
      });

      // 3. Add Initial Courses (if provided)
      let createdCourses: Course[] = [];
      if (Array.isArray(courses) && courses.length > 0) {
        createdCourses = await Promise.all(
          courses.map((courseName: string) =>
            tx.course.create({
              data: {
                userId,
                semesterId: newSemester.id,
                courseName,
              },
            })
          )
        );
      }

      return { user: updatedUser, semester: newSemester, courses: createdCourses };
    });

    return res.status(200).json({
      message: 'Onboarding completed successfully!',
      data: result,
    });
  } catch (error) {
    console.error('Onboarding Error:', error);
    return res.status(500).json({ error: 'Failed to complete onboarding process.' });
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        semesters: {
          where: { isCurrent: true },
          include: { courses: true },
        },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found.' });

    return res.status(200).json({ user });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
};