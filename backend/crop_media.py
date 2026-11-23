NAMES=['小麦', '水稻', '玉米', '大豆', '高粱', '谷子', '棉花', '花生', '土豆', '红薯', '木薯', '芋头', '西红柿', '黄瓜', '茄子', '辣椒', '卷心菜', '生菜', '胡萝卜', '萝卜', '洋葱', '大蒜', '大葱', '菠菜', '大白菜', '花菜', '西兰花', '四季豆', '豌豆', '蚕豆', '扁豆', '豇豆', '向日葵', '油菜', '芝麻', '亚麻']
ALIASES={'番茄':'西红柿','马铃薯':'土豆','甘薯':'红薯','包菜':'卷心菜','菜花':'花菜'}
def requested_crop_images(text):
    if '图片' not in text or '视频' in text or any(w in text for w in ['不要','不用','分析','识别','诊断']):return []
    if not any(w in text for w in ['生成','给我','展示','打开','看','提供','来一','制作']):return []
    matches=set()
    for name in sorted(NAMES+list(ALIASES),key=len,reverse=True):
        if name in text:
            matches.add(ALIASES.get(name,name));text=text.replace(name,'')
    return [{'type':'image','url':f'/api/media/crops/{i+1:02d}','title':name+'图片','width':1920,'height':1080} for i,name in enumerate(NAMES) if name in matches]
