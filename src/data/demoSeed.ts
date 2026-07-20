import type { AppSnapshot } from '../types'

export const DEMO_GIRLFRIEND_ID = 'demo-girlfriend'
export const DEMO_BOYFRIEND_ID = 'demo-boyfriend'

const now = new Date()
const daysAgo = (days: number, hour = 19) => {
  const value = new Date(now)
  value.setDate(value.getDate() - days)
  value.setHours(hour, 20, 0, 0)
  return value.toISOString()
}

export const demoSeed: AppSnapshot = {
  profiles: [
    { id: DEMO_GIRLFRIEND_ID, role: 'girlfriend', displayName: '小满' },
    { id: DEMO_BOYFRIEND_ID, role: 'boyfriend', displayName: '阿川' }
  ],
  categories: [
    { id: 'cat-main', name: '主食', position: 10 },
    { id: 'cat-meat', name: '荤菜', position: 20 },
    { id: 'cat-veg', name: '素菜', position: 30 },
    { id: 'cat-soup', name: '汤羹', position: 40 },
    { id: 'cat-sweet', name: '甜品饮品', position: 50 }
  ],
  interactionCategories: [
    { id: 'love-cat-daily', name: '日常贴贴', position: 10 },
    { id: 'love-cat-company', name: '陪伴时光', position: 20 },
    { id: 'love-cat-mood', name: '小情绪', position: 30 }
  ],
  dishes: [
    { id: 'dish-rice', categoryId: 'cat-main', name: '爱心蛋炒饭', position: 10 },
    { id: 'dish-noodle', categoryId: 'cat-main', name: '番茄鸡蛋面', position: 20 },
    { id: 'dish-wings', categoryId: 'cat-meat', name: '可乐鸡翅', position: 10 },
    { id: 'dish-fish', categoryId: 'cat-meat', name: '清蒸鲈鱼', position: 20 },
    { id: 'dish-veg', categoryId: 'cat-veg', name: '蒜蓉生菜', position: 10 },
    { id: 'dish-soup', categoryId: 'cat-soup', name: '玉米排骨汤', position: 10 },
    { id: 'dish-cake', categoryId: 'cat-sweet', name: '草莓小蛋糕', position: 10 }
  ],
  interactions: [
    { id: 'love-kiss', categoryId: 'love-cat-daily', name: '亲亲', emoji: '💋', color: '#f7a7b4', isSystem: true, position: 10 },
    { id: 'love-hug', categoryId: 'love-cat-daily', name: '抱抱', emoji: '🫂', color: '#e9a6cf', isSystem: true, position: 20 },
    { id: 'love-peace', categoryId: 'love-cat-mood', name: '和好', emoji: '🤝', color: '#e7b37b', isSystem: true, position: 10 },
    { id: 'love-hit', categoryId: 'love-cat-mood', name: '打你', emoji: '👊', color: '#a9b8e8', isSystem: true, position: 20 },
    {
      id: 'love-walk',
      categoryId: 'love-cat-company',
      name: '陪我散步',
      emoji: '🌙',
      color: '#90b8aa',
      isSystem: false,
      creatorId: DEMO_GIRLFRIEND_ID,
      position: 10
    }
  ],
  wishlists: [
    {
      id: 'wish-memory-1',
      senderId: DEMO_GIRLFRIEND_ID,
      receiverId: DEMO_BOYFRIEND_ID,
      note: '少放一点辣，想配着电影吃。',
      createdAt: daysAgo(3)
    },
    {
      id: 'wish-pending-food',
      senderId: DEMO_GIRLFRIEND_ID,
      receiverId: DEMO_BOYFRIEND_ID,
      note: '今晚七点半可以开饭吗？',
      createdAt: daysAgo(0, 17)
    },
    {
      id: 'wish-pending-love',
      senderId: DEMO_BOYFRIEND_ID,
      receiverId: DEMO_GIRLFRIEND_ID,
      note: '忙完来找我呀。',
      createdAt: daysAgo(0, 18)
    }
  ],
  items: [
    {
      id: 'item-memory-wings',
      wishlistId: 'wish-memory-1',
      kind: 'dish',
      referenceId: 'dish-wings',
      nameSnapshot: '可乐鸡翅',
      quantity: 1,
      status: 'served',
      createdAt: daysAgo(3),
      startedAt: daysAgo(3, 18),
      completedAt: daysAgo(3, 20)
    },
    {
      id: 'item-memory-hug',
      wishlistId: 'wish-memory-1',
      kind: 'interaction',
      referenceId: 'love-hug',
      nameSnapshot: '抱抱',
      emojiSnapshot: '🫂',
      quantity: 1,
      status: 'fulfilled',
      createdAt: daysAgo(3),
      startedAt: daysAgo(3, 18),
      completedAt: daysAgo(3, 21)
    },
    {
      id: 'item-pending-rice',
      wishlistId: 'wish-pending-food',
      kind: 'dish',
      referenceId: 'dish-rice',
      nameSnapshot: '爱心蛋炒饭',
      quantity: 2,
      status: 'pending',
      createdAt: daysAgo(0, 17)
    },
    {
      id: 'item-pending-kiss',
      wishlistId: 'wish-pending-food',
      kind: 'interaction',
      referenceId: 'love-kiss',
      nameSnapshot: '亲亲',
      emojiSnapshot: '💋',
      quantity: 1,
      status: 'pending',
      createdAt: daysAgo(0, 17)
    },
    {
      id: 'item-pending-walk',
      wishlistId: 'wish-pending-love',
      kind: 'interaction',
      referenceId: 'love-walk',
      nameSnapshot: '陪我散步',
      emojiSnapshot: '🌙',
      quantity: 1,
      status: 'pending',
      createdAt: daysAgo(0, 18)
    }
  ],
  reviews: [
    {
      id: 'review-wings',
      itemId: 'item-memory-wings',
      reviewerId: DEMO_GIRLFRIEND_ID,
      rating: 5,
      comment: '外焦里嫩，今晚也要抱抱厨师！',
      updatedAt: daysAgo(2, 12)
    }
  ]
}
