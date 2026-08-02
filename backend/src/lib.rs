#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 注意：数据库表结构由前端 database.ts 统一创建和维护（幂等），
    // 不在此处重复定义 migration，避免两处 schema 不一致。
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
