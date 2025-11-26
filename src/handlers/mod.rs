//! HTTP request handlers for all routes.

mod echo;
mod index;
mod private_relay;
mod sha;
mod slot;
mod uuid;

pub use echo::echo;
pub use index::index;
pub use private_relay::icloud_private_relay;
pub use sha::sha;
pub use slot::slot;
pub use uuid::uuid_route;
