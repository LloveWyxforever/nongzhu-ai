import os
import sqlite3
from pathlib import Path
from contextlib import contextmanager

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(os.getenv('NONGZHU_DB', str(ROOT / 'data' / 'nongzhu.db')))

@contextmanager
def db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=15)
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA foreign_keys=ON')
    try:
        yield con
        con.commit()
    finally:
        con.close()

def init():
    with db() as c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS plots(id INTEGER PRIMARY KEY, name TEXT NOT NULL, crop TEXT NOT NULL, region TEXT NOT NULL, area REAL NOT NULL, planted TEXT NOT NULL, stage TEXT NOT NULL, status TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', simulated INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY, plot_id INTEGER REFERENCES plots(id), title TEXT NOT NULL, due TEXT NOT NULL, done INTEGER DEFAULT 0, kind TEXT DEFAULT '农事任务');
        CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY, title TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE, role TEXT, content TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, conversation_id TEXT, plot_id INTEGER REFERENCES plots(id), agent TEXT, status TEXT, result TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY, name TEXT, category TEXT, source TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5(document_id UNINDEXED, content, tokenize='trigram');
        CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY, name TEXT, mime TEXT, path TEXT);
        CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY, message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE, rating INTEGER);
        ''')
        for table,column,definition in [('messages','media',"TEXT NOT NULL DEFAULT '[]'"),('messages','sources',"TEXT NOT NULL DEFAULT '[]'"),('feedback','comment',"TEXT NOT NULL DEFAULT ''")]:
            if column not in [row[1] for row in c.execute(f'PRAGMA table_info({table})')]:
                c.execute(f'ALTER TABLE {table} ADD COLUMN {column} {definition}')
        if 'agent' not in [r[1] for r in c.execute('PRAGMA table_info(conversations)')]:
            c.execute("ALTER TABLE conversations ADD COLUMN agent TEXT NOT NULL DEFAULT 'general'")
        if not c.execute('SELECT count(*) FROM plots').fetchone()[0]:
            entries = [('向阳一号田','水稻','浙江 · 杭州',3.5,'2026-08-12','成熟期','待收获','示例档案，请替换为您的真实数据'),('青禾二号田','小麦','浙江 · 杭州',2.8,'2026-10-16','幼苗期','健康',''),('丰登三号田','玉米','浙江 · 杭州',4.2,'2026-09-01','抽穗期','需关注','示例：叶片偏黄，待现场核查'),('时蔬四号田','蔬菜','浙江 · 杭州',1.6,'2026-10-20','生长期','健康',''),('绿野五号田','大豆','浙江 · 杭州',2.4,'2026-09-12','开花期','健康',''),('稻香六号田','水稻','浙江 · 杭州',3.1,'2026-08-20','灌浆期','健康','')]
            c.executemany('INSERT INTO plots(name,crop,region,area,planted,stage,status,notes,simulated) VALUES(?,?,?,?,?,?,?,?,1)', entries)
            c.executemany('INSERT INTO tasks(plot_id,title,due,kind) VALUES(?,?,?,?)',[(1,'收获前检查与记录','2026-11-15','巡田'),(3,'观察叶片并记录异常范围','2026-11-14','风险观察'),(2,'记录出苗与土壤情况','2026-11-16','巡田')])

def rows(query, params=()):
    with db() as c:
        return [dict(r) for r in c.execute(query, params).fetchall()]
